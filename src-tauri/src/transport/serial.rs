use blocking::unblock;
use futures::channel::mpsc::channel;
use futures::StreamExt;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_serial::{available_ports, SerialPortBuilderExt, SerialPortInfo, SerialPortType};

use tauri::{command, AppHandle, Emitter, Manager, State};
use tauri_plugin_cli::CliExt;

use super::commands::{emit_disconnected, ConnectionCleanup, ConnectionData};

const READ_BUF_SIZE: usize = 1024;

fn usb_serial_candidates(ports: Vec<SerialPortInfo>) -> Vec<super::commands::AvailableDevice> {
    let callout_suffixes = ports
        .iter()
        .filter_map(|port| port.port_name.strip_prefix("/dev/cu."))
        .map(str::to_owned)
        .collect::<std::collections::HashSet<_>>();

    ports
        .into_iter()
        .filter(|port| match port.port_name.strip_prefix("/dev/tty.") {
            Some(suffix) => !callout_suffixes.contains(suffix),
            None => true,
        })
        .filter_map(|port| {
            if let SerialPortType::UsbPort(usb) = port.port_type {
                Some(super::commands::AvailableDevice {
                    id: port.port_name,
                    label: usb.product.unwrap_or("Unnamed device".to_string()),
                })
            } else {
                None
            }
        })
        .collect()
}

#[command]
pub async fn serial_connect(
    id: String,
    app_handle: AppHandle,
    state: State<'_, super::commands::ActiveConnection>,
) -> Result<super::commands::ConnectionHandle, String> {
    crate::frontend_log::diagnostic(format!("[USB] Opening port: {id}"));
    match tokio_serial::new(id.clone(), 9600).open_native_async() {
        Ok(mut port) => {
            #[cfg(unix)]
            port.set_exclusive(false)
                .expect("Unable to set serial port exclusive to false");

            let generation = state.issue_generation()?;
            let (mut reader, mut writer) = tokio::io::split(port);
            let (send, mut recv) = channel::<Vec<u8>>(5);

            let read_app_handle = app_handle.clone();
            let read_process = tauri::async_runtime::spawn(async move {
                let mut buffer = vec![0; READ_BUF_SIZE];
                loop {
                    match reader.read(&mut buffer).await {
                        Ok(0) => {
                            crate::frontend_log::diagnostic("[USB] Read task ended: EOF");
                            break;
                        }
                        Ok(size) => {
                            let _ = read_app_handle.emit(
                                "connection_data",
                                ConnectionData {
                                    generation,
                                    data: buffer[..size].to_vec(),
                                },
                            );
                        }
                        Err(error) => {
                            crate::frontend_log::diagnostic(format!(
                                "[USB] Read task ended with error: {error}"
                            ));
                            break;
                        }
                    }
                }

                let state = read_app_handle.state::<super::commands::ActiveConnection>();
                if state.close_if_current(generation).await {
                    emit_disconnected(&read_app_handle, generation);
                }
            });

            let write_app_handle = app_handle.clone();
            let write_process = tauri::async_runtime::spawn(async move {
                while let Some(data) = recv.next().await {
                    if let Err(error) = writer.write_all(&data).await {
                        crate::frontend_log::diagnostic(format!("[USB] Write failed: {error}"));
                        break;
                    }
                }

                let state = write_app_handle.state::<super::commands::ActiveConnection>();
                if state.close_if_current(generation).await {
                    emit_disconnected(&write_app_handle, generation);
                }
            });

            state
                .open_connection(
                    generation,
                    send,
                    ConnectionCleanup::new(vec![read_process, write_process]),
                )
                .await;

            crate::frontend_log::diagnostic(format!(
                "[USB] Connection established (generation {generation})"
            ));
            Ok(super::commands::ConnectionHandle { generation })
        }
        Err(e) => {
            crate::frontend_log::diagnostic(format!(
                "[USB] Failed to open port {id}: {}",
                e.description
            ));
            Err(format!("Failed to open the serial port: {}", e.description))
        }
    }
}

#[command]
pub async fn serial_list_devices(
    app_handle: AppHandle,
) -> Result<Vec<super::commands::AvailableDevice>, ()> {
    let ports = unblock(available_ports).await.unwrap();

    let mut candidates = usb_serial_candidates(ports);

    if let Ok(m) = app_handle.cli().matches() {
        if let Some(p) = m.args.get("serial-port") {
            if let serde_json::Value::String(path) = &p.value {
                candidates.push(super::commands::AvailableDevice {
                    id: path.to_string(),
                    label: format!("CLI Port: {path}"),
                })
            }
        }
    }

    crate::frontend_log::diagnostic(format!("[USB] Found {} port(s)", candidates.len()));
    for candidate in &candidates {
        crate::frontend_log::diagnostic(format!(
            "[USB] Port: id={}, label={}",
            candidate.id, candidate.label
        ));
    }

    Ok(candidates)
}

#[cfg(test)]
mod tests {
    use super::usb_serial_candidates;
    use tokio_serial::{SerialPortInfo, SerialPortType, UsbPortInfo};

    fn minimal_keys_port(path: &str) -> SerialPortInfo {
        SerialPortInfo {
            port_name: path.to_string(),
            port_type: SerialPortType::UsbPort(UsbPortInfo {
                vid: 0x1d50,
                pid: 0x615e,
                serial_number: Some("F2A88EBCCBC3757A".to_string()),
                manufacturer: Some("ZMK Project".to_string()),
                product: Some("minimal-keys".to_string()),
            }),
        }
    }

    #[test]
    fn macos_callout_and_tty_names_are_one_usb_candidate() {
        let candidates = usb_serial_candidates(vec![
            minimal_keys_port("/dev/cu.usbmodem1101"),
            minimal_keys_port("/dev/tty.usbmodem1101"),
        ]);

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].id, "/dev/cu.usbmodem1101");
    }

    #[test]
    fn tty_name_is_kept_when_no_callout_name_exists() {
        let candidates = usb_serial_candidates(vec![minimal_keys_port("/dev/tty.usbmodem1101")]);

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].id, "/dev/tty.usbmodem1101");
    }
}

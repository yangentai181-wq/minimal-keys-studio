use blocking::unblock;
use futures::channel::mpsc::channel;
use futures::StreamExt;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_serial::{available_ports, SerialPortBuilderExt, SerialPortInfo, SerialPortType};

use tauri::{command, AppHandle, State};
use tauri_plugin_cli::CliExt;

const READ_BUF_SIZE: usize = 1024;

fn usb_serial_candidates(ports: Vec<SerialPortInfo>) -> Vec<super::commands::AvailableDevice> {
    let callout_suffixes = ports
        .iter()
        .filter_map(|port| port.port_name.strip_prefix("/dev/cu."))
        .map(str::to_owned)
        .collect::<std::collections::HashSet<_>>();

    ports
        .into_iter()
        .filter(|pi| match pi.port_name.strip_prefix("/dev/tty.") {
            Some(suffix) => !callout_suffixes.contains(suffix),
            None => true,
        })
        .filter_map(|pi| {
            if let SerialPortType::UsbPort(u) = pi.port_type {
                Some(super::commands::AvailableDevice {
                    id: pi.port_name,
                    label: u.product.unwrap_or("Unnamed device".to_string()),
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
    state: State<'_, super::commands::ActiveConnection<'_>>,
) -> Result<bool, String> {
    match tokio_serial::new(id, 9600).open_native_async() {
        Ok(mut port) => {
            #[cfg(unix)]
            port.set_exclusive(false)
                .expect("Unable to set serial port exclusive to false");

            let (mut reader, mut writer) = tokio::io::split(port);

            let ahc = app_handle.clone();
            let (send, mut recv) = channel(5);
            let session_id = state.activate(Box::new(send)).await;

            let read_process = tauri::async_runtime::spawn(async move {
                use tauri::Emitter;
                use tauri::Manager;

                let mut buffer = vec![0; READ_BUF_SIZE];
                while let Ok(size) = reader.read(&mut buffer).await {
                    if size > 0 {
                        if let Err(error) = app_handle.emit("connection_data", &buffer[..size]) {
                            eprintln!("[Serial] Failed to emit connection data: {error}");
                            break;
                        }
                    } else {
                        break;
                    }
                }

                let state = app_handle.state::<super::commands::ActiveConnection>();
                super::commands::clear_failed_transport_and_notify(&state, session_id, || {
                    app_handle.emit("connection_disconnected", ())
                })
                .await;
            });

            tauri::async_runtime::spawn(async move {
                use tauri::{Emitter, Manager};

                while let Some(data) = recv.next().await {
                    if let Err(error) = writer.write(&data).await {
                        eprintln!("[Serial] Write failed: {error}");
                        let state = ahc.state::<super::commands::ActiveConnection>();
                        super::commands::clear_failed_transport_and_notify(
                            &state,
                            session_id,
                            || ahc.emit("connection_disconnected", ()),
                        )
                        .await;
                        break;
                    }
                }

                let state = ahc.state::<super::commands::ActiveConnection>();
                read_process.abort();
                state.clear_if_current(session_id).await;
            });

            Ok(true)
        }
        Err(e) => Err(format!("Failed to open the serial port: {}", e.description)),
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
                });
            }
        }
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

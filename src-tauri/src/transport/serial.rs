use blocking::unblock;
use futures::channel::mpsc::channel;
use futures::StreamExt;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_serial::{available_ports, SerialPortBuilderExt, SerialPortType};

use tauri::{command, AppHandle, State};
use tauri_plugin_cli::CliExt;

const READ_BUF_SIZE: usize = 1024;

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

    let mut candidates = ports
        .into_iter()
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
        .collect::<Vec<_>>();

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

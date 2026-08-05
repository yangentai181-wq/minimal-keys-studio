use futures::lock::Mutex;
use futures::Sink;
use futures::SinkExt;

use futures::channel::mpsc::SendError;

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};

use tauri::ipc::{InvokeBody, Request};
use tauri::{command, State};

#[derive(Debug, Serialize, Deserialize)]
pub struct AvailableDevice {
    pub label: String,
    pub id: String,
}

#[derive(Debug)]
pub struct ActiveConnection<'a> {
    conn: Mutex<Option<ActiveTransport<'a>>>,
    next_session_id: AtomicU64,
}

type TransportSink<'a> = Box<dyn Sink<Vec<u8>, Error = SendError> + Unpin + Send + 'a>;

struct ActiveTransport<'a> {
    session_id: u64,
    sink: TransportSink<'a>,
}

impl Default for ActiveConnection<'_> {
    fn default() -> Self {
        Self {
            conn: Mutex::new(None),
            next_session_id: AtomicU64::new(0),
        }
    }
}

impl<'a> ActiveConnection<'a> {
    pub async fn activate(&self, sink: TransportSink<'a>) -> u64 {
        let session_id = self.next_session_id.fetch_add(1, Ordering::Relaxed) + 1;
        *self.conn.lock().await = Some(ActiveTransport { session_id, sink });
        session_id
    }

    pub async fn clear_if_current(&self, session_id: u64) -> bool {
        let mut conn = self.conn.lock().await;
        if conn
            .as_ref()
            .map(|active| active.session_id == session_id)
            .unwrap_or(false)
        {
            *conn = None;
            true
        } else {
            false
        }
    }
}

pub async fn clear_failed_transport_and_notify<E, F>(
    connection: &ActiveConnection<'_>,
    session_id: u64,
    notify_disconnect: F,
) -> bool
where
    E: std::fmt::Display,
    F: FnOnce() -> Result<(), E>,
{
    if !connection.clear_if_current(session_id).await {
        return false;
    }

    if let Err(error) = notify_disconnect() {
        eprintln!("[Transport] Failed to emit disconnect notification: {error}");
    }
    true
}

#[command]
pub async fn transport_send_data(
    req: Request<'_>,
    state: State<'_, ActiveConnection<'_>>,
) -> Result<(), ()> {
    if let InvokeBody::Raw(data) = req.body() {
        let mut lock = state.conn.lock().await;

        if let Some(active) = lock.as_mut() {
            if let Err(e) = active.sink.send(data.clone()).await {
                eprintln!("[Transport] Send failed: {:?}", e);
                *lock = None;
                return Err(());
            }
        } else {
            eprintln!("[Transport] No active connection");
            return Err(());
        }
    }

    Ok(())
}

#[command]
pub async fn transport_close(state: State<'_, ActiveConnection<'_>>) -> Result<(), ()> {
    *state.conn.lock().await = None;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{clear_failed_transport_and_notify, ActiveConnection};
    use futures::channel::mpsc::channel;
    use futures::executor::block_on;

    #[test]
    fn only_the_current_transport_session_can_clear_itself() {
        block_on(async {
            let connection = ActiveConnection::default();
            let (first, _) = channel(1);
            let first_id = connection.activate(Box::new(first)).await;
            let (second, _) = channel(1);
            let second_id = connection.activate(Box::new(second)).await;

            assert!(!connection.clear_if_current(first_id).await);
            assert!(connection.clear_if_current(second_id).await);
            assert!(!connection.clear_if_current(second_id).await);
        });
    }

    #[test]
    fn failed_transport_notifies_only_when_its_session_is_still_current() {
        block_on(async {
            let connection = ActiveConnection::default();
            let (first, _) = channel(1);
            let first_id = connection.activate(Box::new(first)).await;
            let (second, _) = channel(1);
            let second_id = connection.activate(Box::new(second)).await;
            let mut notifications = 0;

            assert!(
                !clear_failed_transport_and_notify::<&str, _>(&connection, first_id, || {
                    notifications += 1;
                    Ok(())
                })
                .await
            );
            assert_eq!(notifications, 0);

            assert!(
                clear_failed_transport_and_notify::<&str, _>(&connection, second_id, || {
                    notifications += 1;
                    Err("event listener missing")
                })
                .await
            );
            assert_eq!(notifications, 1);
        });
    }
}

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

use hidapi::HidApi;
use serde::Serialize;
use tauri::{command, AppHandle, Emitter, State};

const RAW_HID_USAGE_PAGE: u16 = 0xff60;
const RAW_HID_USAGE: u16 = 0x61;
const READ_TIMEOUT_MS: i32 = 100;
const READ_BUFFER_SIZE: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HidLifecycle {
    Idle,
    Open,
}

impl HidLifecycle {
    pub fn request_open(self) -> Result<Self, &'static str> {
        match self {
            Self::Idle => Ok(Self::Open),
            Self::Open => Err("Raw HID is already open"),
        }
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn close(self) -> Self {
        Self::Idle
    }

}

pub fn matches_usage(usage_page: u16, usage: u16) -> bool {
    usage_page == RAW_HID_USAGE_PAGE && usage == RAW_HID_USAGE
}

#[derive(Debug, Serialize)]
pub struct RawHidDeviceInfo {
    pub vendor_id: u16,
    pub product_id: u16,
    pub product_name: Option<String>,
}

#[derive(Clone, Default)]
pub struct RawHidState {
    reader: Arc<Mutex<Option<RawHidReader>>>,
}

#[derive(Clone)]
struct RawHidReader {
    stop: Arc<AtomicBool>,
}

fn clear_reader(state: &RawHidState, stop: &Arc<AtomicBool>) -> bool {
    let mut reader = state.reader.lock().expect("Raw HID state lock poisoned");
    if matches!(
        reader.as_ref(),
        Some(active) if Arc::ptr_eq(&active.stop, stop)
    ) {
        *reader = None;
        true
    } else {
        false
    }
}

#[command]
pub fn raw_hid_open(
    app_handle: AppHandle,
    state: State<'_, RawHidState>,
) -> Result<RawHidDeviceInfo, String> {
    let mut reader = state
        .reader
        .lock()
        .map_err(|_| "Raw HID state lock poisoned")?;
    (if reader.is_some() {
        HidLifecycle::Open
    } else {
        HidLifecycle::Idle
    })
    .request_open()
    .map_err(str::to_string)?;

    let api = HidApi::new().map_err(|error| format!("Failed to enumerate HID devices: {error}"))?;
    let info = api
        .device_list()
        .find(|device| matches_usage(device.usage_page(), device.usage()))
        .ok_or_else(|| "minimal-keys Raw HID interface was not found".to_string())?;
    let device_info = RawHidDeviceInfo {
        vendor_id: info.vendor_id(),
        product_id: info.product_id(),
        product_name: info.product_string().map(str::to_string),
    };
    let device = info
        .open_device(&api)
        .map_err(|error| format!("Failed to open Raw HID device: {error}"))?;

    let stop = Arc::new(AtomicBool::new(false));
    *reader = Some(RawHidReader { stop: stop.clone() });
    drop(reader);

    let reader_state = state.inner().clone();
    std::thread::spawn(move || {
        let mut buffer = [0; READ_BUFFER_SIZE];
        while !stop.load(Ordering::Relaxed) {
            match device.read_timeout(&mut buffer, READ_TIMEOUT_MS) {
                Ok(size) if size > 0 => {
                    let _ = app_handle.emit("raw_hid_input", buffer[..size].to_vec());
                }
                Ok(_) => {}
                Err(error) => {
                    if clear_reader(&reader_state, &stop) {
                        let _ = app_handle.emit("raw_hid_error", error.to_string());
                    }
                    return;
                }
            }
        }
        clear_reader(&reader_state, &stop);
    });

    Ok(device_info)
}

#[command]
pub fn raw_hid_close(state: State<'_, RawHidState>) -> Result<(), String> {
    let mut reader = state
        .reader
        .lock()
        .map_err(|_| "Raw HID state lock poisoned")?;
    if let Some(active) = reader.take() {
        active.stop.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{clear_reader, matches_usage, HidLifecycle, RawHidReader, RawHidState};
    use std::sync::{atomic::AtomicBool, Arc, Mutex};

    #[test]
    fn accepts_only_minimal_keys_vendor_interface() {
        assert!(matches_usage(0xff60, 0x61));
        assert!(!matches_usage(0x0001, 0x0006));
    }

    #[test]
    fn rejects_other_vendor_interfaces() {
        assert!(!matches_usage(0xff60, 0x62));
    }

    #[test]
    fn refuses_a_duplicate_open() {
        assert_eq!(
            HidLifecycle::Open.request_open(),
            Err("Raw HID is already open")
        );
    }

    #[test]
    fn close_returns_open_reader_to_idle() {
        assert_eq!(HidLifecycle::Open.close(), HidLifecycle::Idle);
    }

    #[test]
    fn read_error_cleans_up_the_production_reader_state_once() {
        let stop = Arc::new(AtomicBool::new(false));
        let state = RawHidState {
            reader: Arc::new(Mutex::new(Some(RawHidReader { stop: stop.clone() }))),
        };

        assert!(clear_reader(&state, &stop));
        assert!(state.reader.lock().unwrap().is_none());
        assert!(!clear_reader(&state, &stop));
    }
}

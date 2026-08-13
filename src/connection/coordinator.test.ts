import { describe, expect, it } from "vitest";

import {
  describeConnection,
  initialCoordinatorState,
  reduceConnection,
  type CoordinatorEvent,
  type CoordinatorState,
} from "./coordinator";

function run(events: CoordinatorEvent[]): CoordinatorState {
  return events.reduce(reduceConnection, initialCoordinatorState);
}

describe("reduceConnection", () => {
  it("reports right_usb_not_detected when no granted device is visible", () => {
    const state = run([{ type: "usb_detection_result", visible: false }]);
    expect(state.phase).toBe("right_usb_not_detected");
  });

  it("reaches rawhid_monitor_ready without any Studio RPC contract", () => {
    const state = run([
      { type: "usb_detection_result", visible: true },
      { type: "webhid_opening" },
      { type: "webhid_ready" },
    ]);
    expect(state.phase).toBe("rawhid_monitor_ready");
    expect(state.contracts.rawHidMonitor).toBe(true);
    expect(state.contracts.studioRpc).toBe(false);
    expect(describeConnection(state).monitorAvailable).toBe(true);
  });

  it("maps serial open + getDeviceInfo timeout to serial_open_but_rpc_unavailable (monitor kept)", () => {
    const state = run([
      { type: "usb_detection_result", visible: true },
      { type: "webhid_opening" },
      { type: "webhid_ready" },
      { type: "webserial_opening" },
      { type: "serial_rpc_timeout" },
    ]);
    expect(state.phase).toBe("serial_open_but_rpc_unavailable");
    expect(state.contracts.rawHidMonitor).toBe(true);
    expect(state.contracts.studioRpc).toBe(false);
    const description = describeConnection(state);
    expect(description.monitorAvailable).toBe(true);
    expect(description.editorAvailable).toBe(false);
  });

  it("maps timeout without monitor to firmware_contract_mismatch", () => {
    const state = run([
      { type: "usb_detection_result", visible: true },
      { type: "webhid_opening" },
      { type: "webhid_unavailable", reason: "no device" },
      { type: "webserial_opening" },
      { type: "serial_rpc_timeout" },
    ]);
    expect(state.phase).toBe("firmware_contract_mismatch");
    const description = describeConnection(state);
    expect(description.monitorAvailable).toBe(false);
    expect(description.editorAvailable).toBe(false);
  });

  it("maps a busy serial port to busy_or_already_open", () => {
    const state = run([
      { type: "webserial_opening" },
      { type: "serial_busy", reason: "held by another tab" },
    ]);
    expect(state.phase).toBe("busy_or_already_open");
  });

  it("establishes the editor contract only via studio_rpc_ready", () => {
    const state = run([
      { type: "webhid_opening" },
      { type: "webhid_ready" },
      { type: "webserial_opening" },
      { type: "studio_rpc_ready", transport: "usb", deviceName: "minimal-keys" },
    ]);
    expect(state.phase).toBe("studio_rpc_ready");
    expect(state.contracts.studioRpc).toBe(true);
    expect(state.contracts.studioTransport).toBe("usb");
    expect(state.deviceName).toBe("minimal-keys");
  });

  it("treats BLE Studio RPC without a monitor as ble_optional_ready", () => {
    const state = run([{ type: "studio_rpc_ready", transport: "ble" }]);
    expect(state.phase).toBe("ble_optional_ready");
    expect(state.contracts.studioTransport).toBe("ble");
  });

  it("clears the monitor contract on monitor_closed", () => {
    const state = run([
      { type: "webhid_opening" },
      { type: "webhid_ready" },
      { type: "monitor_closed" },
    ]);
    expect(state.contracts.rawHidMonitor).toBe(false);
    expect(state.phase).toBe("idle");
  });
});

describe("describeConnection copy", () => {
  it("explains the endpoint/BLE cause for serial_open_but_rpc_unavailable", () => {
    const state = run([
      { type: "webhid_ready" },
      { type: "serial_rpc_timeout" },
    ]);
    const { title, body } = describeConnection(state);
    expect(title).toContain("モニターのみ利用可");
    expect(body).toContain("出力先がBLE");
    expect(body).toContain("&out OUT_USB");
  });

  it("tells the user when the port is held by another process", () => {
    const state = run([{ type: "serial_busy" }]);
    expect(describeConnection(state).body).toContain("他のタブ・アプリ");
  });

  it("asks for a reflash only when no contract works at all", () => {
    const state = run([
      { type: "webhid_unavailable" },
      { type: "serial_rpc_timeout" },
    ]);
    expect(describeConnection(state).body).toContain("焼き直し");
  });

  it("reports the not-detected state in terms of the OS view", () => {
    const state = run([{ type: "usb_detection_result", visible: false }]);
    expect(describeConnection(state).body).toContain("OSから見えていません");
  });
});

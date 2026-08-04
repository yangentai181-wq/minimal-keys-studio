import * as _m0 from "protobufjs/minimal";

export const SUBSYSTEM_ID = "trackball_settings";

export interface BindingSnapshot {
  behaviorId: number;
  param1: number;
  param2: number;
}

export interface TrackballConfig {
  schemaVersion: number;
  normalCpi: number;
  precisionCpi: number;
  enabled: boolean;
  selectedPosition: number;
  originalBinding: BindingSnapshot | null;
  revision: number;
  precisionActive: boolean;
  currentCpi: number;
}

export interface PrecisionDraft {
  normalCpi: number;
  precisionCpi: number;
  enabled: boolean;
  selectedPosition: number;
}

export const ApplyResult = {
  OK: 0,
  INVALID_CPI: 1,
  INVALID_POSITION: 2,
  UNSUPPORTED_BINDING: 3,
  STALE_REVISION: 4,
  KEYMAP_WRITE_FAILED: 5,
  SETTINGS_WRITE_FAILED: 6,
  SENSOR_WRITE_FAILED: 7,
} as const;
export type ApplyResult = (typeof ApplyResult)[keyof typeof ApplyResult];

export interface ApplyResponse {
  result: ApplyResult;
  config: TrackballConfig | null;
}

export interface TrackballResponse {
  get?: TrackballConfig;
  validate?: ApplyResponse;
  apply?: ApplyResponse;
}

export function encodeGet(): Uint8Array {
  return _m0.Writer.create().uint32(10).fork().ldelim().finish();
}

export function encodeValidate(draft: PrecisionDraft, expectedRevision: number): Uint8Array {
  return encodeRequest(2, draft, expectedRevision);
}

export function encodeApply(draft: PrecisionDraft, expectedRevision: number): Uint8Array {
  return encodeRequest(3, draft, expectedRevision);
}

function encodeRequest(field: number, draft: PrecisionDraft, expectedRevision: number): Uint8Array {
  const request = _m0.Writer.create();
  if (draft.normalCpi !== 0) request.uint32(8).uint32(draft.normalCpi);
  if (draft.precisionCpi !== 0) request.uint32(16).uint32(draft.precisionCpi);
  if (draft.enabled) {
    request.uint32(24).bool(true);
    request.uint32(32).uint32(draft.selectedPosition);
  }
  if (expectedRevision !== 0) request.uint32(40).uint32(expectedRevision);
  return _m0.Writer.create().uint32((field << 3) | 2).bytes(request.finish()).finish();
}

function emptyConfig(): TrackballConfig {
  return {
    schemaVersion: 0, normalCpi: 0, precisionCpi: 0, enabled: false, selectedPosition: 0,
    originalBinding: null, revision: 0, precisionActive: false, currentCpi: 0,
  };
}

function decodeBinding(reader: _m0.Reader, length: number): BindingSnapshot {
  const end = reader.pos + length;
  const binding: BindingSnapshot = { behaviorId: 0, param1: 0, param2: 0 };
  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1: binding.behaviorId = reader.uint32(); break;
      case 2: binding.param1 = reader.uint32(); break;
      case 3: binding.param2 = reader.uint32(); break;
      default: reader.skipType(tag & 7); break;
    }
  }
  return binding;
}

function decodeConfig(reader: _m0.Reader, length: number): TrackballConfig {
  const end = reader.pos + length;
  const config = emptyConfig();
  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1: config.schemaVersion = reader.uint32(); break;
      case 2: config.normalCpi = reader.uint32(); break;
      case 3: config.precisionCpi = reader.uint32(); break;
      case 4: config.enabled = reader.bool(); break;
      case 5: config.selectedPosition = reader.uint32(); break;
      case 6: config.originalBinding = decodeBinding(reader, reader.uint32()); break;
      case 7: config.revision = reader.uint32(); break;
      case 8: config.precisionActive = reader.bool(); break;
      case 9: config.currentCpi = reader.uint32(); break;
      default: reader.skipType(tag & 7); break;
    }
  }
  if (reader.pos !== end) throw new Error("Malformed trackball config payload");
  return config;
}

function decodeApplyResponse(reader: _m0.Reader, length: number): ApplyResponse {
  const end = reader.pos + length;
  const response: ApplyResponse = { result: ApplyResult.OK, config: null };
  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1: response.result = reader.int32() as ApplyResult; break;
      case 2: response.config = decodeConfig(reader, reader.uint32()); break;
      default: reader.skipType(tag & 7); break;
    }
  }
  if (reader.pos !== end) throw new Error("Malformed trackball apply response");
  return response;
}

export function decodeResponse(payload: Uint8Array): TrackballResponse {
  const reader = _m0.Reader.create(payload);
  const response: TrackballResponse = {};
  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1: response.get = decodeConfig(reader, reader.uint32()); break;
      case 2: response.validate = decodeApplyResponse(reader, reader.uint32()); break;
      case 3: response.apply = decodeApplyResponse(reader, reader.uint32()); break;
      default: reader.skipType(tag & 7); break;
    }
  }
  return response;
}

export function decodeNotification(payload: Uint8Array): TrackballConfig {
  const reader = _m0.Reader.create(payload);
  let config: TrackballConfig | null = null;
  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    if ((tag >>> 3) === 1) config = decodeConfig(reader, reader.uint32());
    else reader.skipType(tag & 7);
  }
  if (config === null) throw new Error("Trackball notification did not contain a changed config");
  return config;
}

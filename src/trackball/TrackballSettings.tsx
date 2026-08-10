import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { SubsystemUnavailable } from "../misc/SubsystemUnavailable";
import {
  useCustomSubsystem,
  useCustomNotification,
} from "../rpc/useCustomSubsystem";
import { useToast } from "../misc/Toast";
import * as RIP from "../proto/rip";
import { TrackballPrecisionSettings } from "./TrackballPrecisionSettings";
import { ERROR_MESSAGES } from "../copy/errorMessages";
import { useStudioKeymap } from "../keyboard/useStudioKeymap";
import { useDirtyRegistration } from "../navigation/DirtyStateContext";
import {
  decodeScrollLayerSelection,
  encodeAutoMouseLayerId,
  encodeScrollLayerMask,
} from "./layer-settings";

type TrackballDraft = {
  selectedId: number | null;
  multiplier: number;
  divisor: number;
  rotation: number;
  xInvert: boolean;
  yInvert: boolean;
  xySwap: boolean;
  xyToScroll: boolean;
  axisSnapMode: RIP.AxisSnapMode;
  axisSnapThreshold: number;
  axisSnapTimeout: number;
  scrollLayerId: number | null;
  scrollMask: number;
  scrollTouched: boolean;
  autoMouseEnabled: boolean;
  autoMouseLayerId: number | null;
  autoMouseDeactivationDelayMs: number;
};

function sameDraft(left: TrackballDraft, right: TrackballDraft) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function TrackballSettings() {
  const subsystem = useCustomSubsystem(RIP.SUBSYSTEM_ID);
  const { toast } = useToast();
  const [processors, setProcessors] = useState<RIP.InputProcessorInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Local form state (editable copy of selected processor)
  // Speed is represented as multiplier/divisor. We use divisor=10 as base
  // so 0.1 steps work: 0.1x=1/10, 0.5x=5/10, 1.0x=10/10, 2.0x=20/10, etc.
  const [multiplier, setMultiplier] = useState(1);
  const [divisor, setDivisor] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Derived speed value for slider (in 0.1 steps)
  const speedValue = divisor > 0 ? multiplier / divisor : 1;
  const setSpeed = useCallback((speed: number) => {
    const newMultiplier = Math.round(speed * 10);
    setMultiplier(newMultiplier);
    setDivisor(10);
  }, []);
  const [xInvert, setXInvert] = useState(false);
  const [yInvert, setYInvert] = useState(false);
  const [xySwap, setXySwap] = useState(false);
  const [xyToScroll, setXyToScroll] = useState(false);
  const [axisSnapMode, setAxisSnapMode] = useState<RIP.AxisSnapMode>(0);
  const [axisSnapThreshold, setAxisSnapThreshold] = useState(0);
  const [axisSnapTimeout, setAxisSnapTimeout] = useState(0);
  const [scrollLayerId, setScrollLayerId] = useState<number | null>(null);
  const [scrollMask, setScrollMask] = useState(0);
  const [scrollTouched, setScrollTouched] = useState(false);
  const [autoMouseEnabled, setAutoMouseEnabled] = useState(false);
  const [autoMouseLayerId, setAutoMouseLayerId] = useState<number | null>(null);
  const [autoMouseDeactivationDelayMs, setAutoMouseDeactivationDelayMs] = useState(700);
  const [scrollWarning, setScrollWarning] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const selectedIdRef = useRef(selectedId);
  const subsystemRef = useRef(subsystem);
  const draftRef = useRef<TrackballDraft | null>(null);
  const { layers } = useStudioKeymap();

  selectedIdRef.current = selectedId;
  subsystemRef.current = subsystem;
  draftRef.current = { selectedId, multiplier, divisor, rotation, xInvert, yInvert, xySwap, xyToScroll, axisSnapMode, axisSnapThreshold, axisSnapTimeout, scrollLayerId, scrollMask, scrollTouched, autoMouseEnabled, autoMouseLayerId, autoMouseDeactivationDelayMs };

  // Discover processors via listInputProcessors (data arrives via notifications)
  useEffect(() => {
    if (!subsystem) {
      requestGeneration.current++;
      setProcessors([]);
      setSelectedId(null);
      return;
    }

    async function discover() {
      if (!subsystem) return;
      try {
        await subsystem.callRPC(RIP.encodeListInputProcessors());
        // Response is empty; processor info arrives via notifications
      } catch (e) {
        console.error("Failed to discover processors:", e);
        toast(ERROR_MESSAGES["trackball.discover"], "error");
      }
    }

    discover();
  }, [subsystem, toast]);

  // Listen for notifications (processor discovery + real-time updates)
  const formDirty = useRef(false);

  useCustomNotification(subsystem?.subsystemIndex, (payload) => {
    const notif = RIP.decodeNotification(payload);
    if (notif.inputProcessorChanged) {
      const proc = notif.inputProcessorChanged;
      // Always update processor list
      setProcessors((prev) => {
        const idx = prev.findIndex((p) => p.id === proc.id);
        if (idx >= 0) {
          if (proc.id === selectedId && (saving || formDirty.current)) return prev;
          const updated = [...prev];
          updated[idx] = proc;
          return updated;
        }
        return [...prev, proc];
      });

      // Auto-select first processor on initial discovery
      setSelectedId((currentId) => {
        if (currentId === null) {
          applyProcessorInfo(proc);
          formDirty.current = false;
          return proc.id;
        }
        return currentId;
      });
    }
  });

  const applyProcessorInfo = useCallback((info: RIP.InputProcessorInfo) => {
    setMultiplier(info.scaleMultiplier);
    setDivisor(info.scaleDivisor);
    setRotation(info.rotationDegrees);
    setXInvert(info.xInvert);
    setYInvert(info.yInvert);
    setXySwap(info.xySwapEnabled);
    setXyToScroll(info.xyToScrollEnabled);
    setAxisSnapMode(info.axisSnapMode);
    setAxisSnapThreshold(info.axisSnapThreshold);
    setAxisSnapTimeout(info.axisSnapTimeoutMs);
    const scroll = decodeScrollLayerSelection(info.scrollLayers, layers);
    setScrollLayerId(scroll.kind === "single" ? scroll.layerId : null);
    setScrollMask(info.scrollLayers);
    setScrollTouched(false);
    setScrollWarning(scroll.kind === "multiple" ? "複数レイヤーが設定されています。次に選んだ1つへ置き換わります" : scroll.kind === "unavailable" ? ERROR_MESSAGES["trackball.layerUnavailable"] : null);
    setAutoMouseEnabled(info.tempLayerEnabled);
    setAutoMouseLayerId(info.tempLayerLayer);
    setAutoMouseDeactivationDelayMs(info.tempLayerDeactivationDelayMs || 100);
  }, [layers]);

  const selectedProcessor = processors.find((p) => p.id === selectedId) ?? null;
  const confirmedScroll = selectedProcessor ? decodeScrollLayerSelection(selectedProcessor.scrollLayers, layers) : { kind: "none" as const };
  const visibleScrollLayerId = scrollTouched ? scrollLayerId : confirmedScroll.kind === "single" ? confirmedScroll.layerId : null;
  const visibleScrollWarning = scrollTouched
    ? scrollWarning
    : confirmedScroll.kind === "multiple"
      ? "複数レイヤーが設定されています。次に選んだ1つへ置き換わります"
      : confirmedScroll.kind === "unavailable"
        ? ERROR_MESSAGES["trackball.layerUnavailable"]
        : null;
  const dirty = selectedProcessor !== null && (
    multiplier !== selectedProcessor.scaleMultiplier || divisor !== selectedProcessor.scaleDivisor || rotation !== selectedProcessor.rotationDegrees ||
    xInvert !== selectedProcessor.xInvert || yInvert !== selectedProcessor.yInvert || xySwap !== selectedProcessor.xySwapEnabled || xyToScroll !== selectedProcessor.xyToScrollEnabled ||
    axisSnapMode !== selectedProcessor.axisSnapMode || axisSnapThreshold !== selectedProcessor.axisSnapThreshold || axisSnapTimeout !== selectedProcessor.axisSnapTimeoutMs ||
    (scrollTouched && scrollMask !== selectedProcessor.scrollLayers) || autoMouseEnabled !== selectedProcessor.tempLayerEnabled ||
    autoMouseLayerId !== selectedProcessor.tempLayerLayer || autoMouseDeactivationDelayMs !== selectedProcessor.tempLayerDeactivationDelayMs
  );
  useEffect(() => { formDirty.current = dirty; }, [dirty]);

  const callWithTimeout = useCallback(
    async (label: string, payload: Uint8Array, expectedResponseType: RIP.RipResponseType) => {
      if (!subsystem) throw new Error("No subsystem");
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`RPC timeout: ${label}`)), 5000)
      );
      const raw = await Promise.race([subsystem.callRPC(payload), timeout]);
      if (!(raw instanceof Uint8Array)) throw new Error(`Empty RPC response: ${label}`);
      const response = RIP.decodeResponse(raw);
      if (response.error) throw new Error(response.error);
      if (response.responseType !== expectedResponseType) throw new Error(`Unexpected RPC response: ${label}`);
      return response;
    },
    [subsystem]
  );

  const normalizeDeactivationDelay = (value: number) => Math.min(5000, Math.max(100, Math.round(value / 50) * 50));
  const isUnsupportedScrollResponse = (error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    return message === "Failed to process request" || message.startsWith("Empty RPC response") || message.startsWith("Unexpected RPC response");
  };

  const handleApply = useCallback(async (): Promise<boolean> => {
    if (!subsystem || selectedId === null || !selectedProcessor) return false;
    const generation = ++requestGeneration.current;
    const id = selectedId;
    const submittedDraft = draftRef.current;
    setSaving(true);
    try {
      const selectedScrollLayer = scrollLayerId === null ? null : layers.find((layer) => layer.id === scrollLayerId);
      const selectedAutoMouseLayer = autoMouseLayerId === null ? null : layers.find((layer) => layer.id === autoMouseLayerId);
      if (scrollTouched && scrollLayerId !== null && !selectedScrollLayer) throw new Error(ERROR_MESSAGES["trackball.layerUnavailable"]);
      if (autoMouseLayerId === null || !selectedAutoMouseLayer) throw new Error(ERROR_MESSAGES["trackball.layerUnavailable"]);
      const nextScrollMask = scrollTouched ? (selectedScrollLayer ? encodeScrollLayerMask(selectedScrollLayer) : 0) : scrollMask;
      const autoMouseLayer = encodeAutoMouseLayerId(selectedAutoMouseLayer);
      const normalizedDelay = normalizeDeactivationDelay(autoMouseDeactivationDelayMs);
      if (multiplier !== selectedProcessor.scaleMultiplier) {
        await callWithTimeout("setScaleMultiplier", RIP.encodeSetScaleMultiplier(id, multiplier), "setScaleMultiplier");
      }
      if (divisor !== selectedProcessor.scaleDivisor) {
        await callWithTimeout("setScaleDivisor", RIP.encodeSetScaleDivisor(id, divisor), "setScaleDivisor");
      }
      if (rotation !== selectedProcessor.rotationDegrees) {
        await callWithTimeout("setRotation", RIP.encodeSetRotation(id, rotation), "setRotation");
      }
      if (xInvert !== selectedProcessor.xInvert) {
        await callWithTimeout("setXInvert", RIP.encodeSetXInvert(id, xInvert), "setXInvert");
      }
      if (yInvert !== selectedProcessor.yInvert) {
        await callWithTimeout("setYInvert", RIP.encodeSetYInvert(id, yInvert), "setYInvert");
      }
      if (xySwap !== selectedProcessor.xySwapEnabled) {
        await callWithTimeout("setXySwapEnabled", RIP.encodeSetXySwapEnabled(id, xySwap), "setXySwapEnabled");
      }
      if (xyToScroll !== selectedProcessor.xyToScrollEnabled) {
        await callWithTimeout("setXyToScrollEnabled", RIP.encodeSetXyToScrollEnabled(id, xyToScroll), "setXyToScrollEnabled");
      }
      if (axisSnapMode !== selectedProcessor.axisSnapMode) {
        await callWithTimeout("setAxisSnapMode", RIP.encodeSetAxisSnapMode(id, axisSnapMode), "setAxisSnapMode");
      }
      if (axisSnapThreshold !== selectedProcessor.axisSnapThreshold) {
        await callWithTimeout("setAxisSnapThreshold", RIP.encodeSetAxisSnapThreshold(id, axisSnapThreshold), "setAxisSnapThreshold");
      }
      if (axisSnapTimeout !== selectedProcessor.axisSnapTimeoutMs) {
        await callWithTimeout("setAxisSnapTimeout", RIP.encodeSetAxisSnapTimeout(id, axisSnapTimeout), "setAxisSnapTimeout");
      }
      if (nextScrollMask !== selectedProcessor.scrollLayers) {
        try {
          await callWithTimeout("setScrollLayers", RIP.encodeSetScrollLayers(id, nextScrollMask), "setScrollLayers");
        } catch (error) {
          if (isUnsupportedScrollResponse(error)) toast(ERROR_MESSAGES["trackball.scrollFirmwareRequired"], "error");
          throw error;
        }
      }
      if (autoMouseEnabled !== selectedProcessor.tempLayerEnabled) await callWithTimeout("setTempLayerEnabled", RIP.encodeSetTempLayerEnabled(id, autoMouseEnabled), "setTempLayerEnabled");
      if (autoMouseLayer !== selectedProcessor.tempLayerLayer) await callWithTimeout("setTempLayerLayer", RIP.encodeSetTempLayerLayer(id, autoMouseLayer), "setTempLayerLayer");
      if (normalizedDelay !== selectedProcessor.tempLayerDeactivationDelayMs) await callWithTimeout("setTempLayerDeactivationDelay", RIP.encodeSetTempLayerDeactivationDelay(id, normalizedDelay), "setTempLayerDeactivationDelay");
      const readback = await callWithTimeout("getInputProcessor", RIP.encodeGetInputProcessor(id), "getInputProcessor");
      if (!readback.getInputProcessor || readback.getInputProcessor.id !== id) throw new Error("Invalid readback");
      const confirmed = readback.getInputProcessor;
      if (confirmed.scaleMultiplier !== multiplier || confirmed.scaleDivisor !== divisor || confirmed.rotationDegrees !== rotation || confirmed.xInvert !== xInvert || confirmed.yInvert !== yInvert || confirmed.xySwapEnabled !== xySwap || confirmed.xyToScrollEnabled !== xyToScroll || confirmed.axisSnapMode !== axisSnapMode || confirmed.axisSnapThreshold !== axisSnapThreshold || confirmed.axisSnapTimeoutMs !== axisSnapTimeout || confirmed.scrollLayers !== nextScrollMask || confirmed.tempLayerEnabled !== autoMouseEnabled || confirmed.tempLayerLayer !== autoMouseLayer || confirmed.tempLayerDeactivationDelayMs !== normalizedDelay) throw new Error("Readback did not match draft");
      if (generation !== requestGeneration.current || id !== selectedId) return false;
      setProcessors((previous) => previous.map((processor) => processor.id === confirmed.id ? confirmed : processor));
      const draftUnchanged = submittedDraft !== null && draftRef.current !== null && sameDraft(submittedDraft, draftRef.current);
      if (draftUnchanged) {
        applyProcessorInfo(confirmed);
        formDirty.current = false;
      }
      return draftUnchanged;
    } catch (e) {
      if (generation === requestGeneration.current) {
        try {
          const readback = await callWithTimeout("getInputProcessor", RIP.encodeGetInputProcessor(id), "getInputProcessor");
          if (generation === requestGeneration.current && subsystemRef.current === subsystem && selectedIdRef.current === id && readback.getInputProcessor?.id === id) {
            setProcessors((previous) => previous.map((processor) => processor.id === id ? readback.getInputProcessor! : processor));
          }
        } catch { /* draft deliberately remains untouched */ }
      }
      console.error("Failed to apply trackball config:", e);
      toast(ERROR_MESSAGES["trackball.apply"], "error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    subsystem,
    callWithTimeout,
    selectedId,
    selectedProcessor,
    multiplier,
    divisor,
    rotation,
    xInvert,
    yInvert,
    xySwap,
    xyToScroll,
    axisSnapMode,
    axisSnapThreshold,
    axisSnapTimeout,
    scrollLayerId,
    scrollMask,
    scrollTouched,
    autoMouseEnabled,
    autoMouseLayerId,
    autoMouseDeactivationDelayMs,
    layers,
    applyProcessorInfo,
    toast,
  ]);

  const handleReset = useCallback(async () => {
    if (!subsystem || selectedId === null || saving) return;
    const generation = ++requestGeneration.current;
    const id = selectedId;
    const submittedDraft = draftRef.current;
    setSaving(true);
    try {
      await callWithTimeout("resetInputProcessor", RIP.encodeResetInputProcessor(id), "resetInputProcessor");
      const readback = await callWithTimeout("getInputProcessor", RIP.encodeGetInputProcessor(id), "getInputProcessor");
      if (!readback.getInputProcessor || readback.getInputProcessor.id !== id) throw new Error("Invalid readback");
      if (generation !== requestGeneration.current) return;
      setProcessors((previous) => previous.map((processor) => processor.id === id ? readback.getInputProcessor! : processor));
      if (submittedDraft && draftRef.current && sameDraft(submittedDraft, draftRef.current)) {
        applyProcessorInfo(readback.getInputProcessor);
        formDirty.current = false;
      }
    } catch (e) {
      console.error("Failed to reset trackball config:", e);
      toast(ERROR_MESSAGES["trackball.reset"], "error");
    } finally {
      setSaving(false);
    }
  }, [subsystem, selectedId, saving, callWithTimeout, applyProcessorInfo, toast]);

  useDirtyRegistration("trackball", {
    dirty,
    save: handleApply,
    discard: async () => { if (!selectedProcessor) return true; applyProcessorInfo(selectedProcessor); formDirty.current = false; return true; },
    snapshot: () => ({ selectedId, multiplier, divisor, rotation, xInvert, yInvert, xySwap, xyToScroll, axisSnapMode, axisSnapThreshold, axisSnapTimeout, scrollLayerId, scrollMask, scrollTouched, autoMouseEnabled, autoMouseLayerId, autoMouseDeactivationDelayMs }),
    restore: (snapshot) => {
      const draft = snapshot as { selectedId: number | null; multiplier: number; divisor: number; rotation: number; xInvert: boolean; yInvert: boolean; xySwap: boolean; xyToScroll: boolean; axisSnapMode: RIP.AxisSnapMode; axisSnapThreshold: number; axisSnapTimeout: number; scrollLayerId: number | null; scrollMask: number; scrollTouched: boolean; autoMouseEnabled: boolean; autoMouseLayerId: number | null; autoMouseDeactivationDelayMs: number };
      setSelectedId(draft.selectedId); setMultiplier(draft.multiplier); setDivisor(draft.divisor); setRotation(draft.rotation); setXInvert(draft.xInvert); setYInvert(draft.yInvert); setXySwap(draft.xySwap); setXyToScroll(draft.xyToScroll); setAxisSnapMode(draft.axisSnapMode); setAxisSnapThreshold(draft.axisSnapThreshold); setAxisSnapTimeout(draft.axisSnapTimeout); setScrollLayerId(draft.scrollLayerId); setScrollMask(draft.scrollMask); setScrollTouched(draft.scrollTouched); setAutoMouseEnabled(draft.autoMouseEnabled); setAutoMouseLayerId(draft.autoMouseLayerId); setAutoMouseDeactivationDelayMs(draft.autoMouseDeactivationDelayMs);
    },
  });

  if (!subsystem) {
    return (
      <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-full">
        <TrackballPrecisionSettings />
        <SubsystemUnavailable
          featureName="トラックボール設定"
          explanation="キーボードのファームウェアがこの機能に対応していないか、接続方法を確認してください。"
          technicalDetails="CONFIG_ZMK_RUNTIME_INPUT_PROCESSOR_STUDIO_RPC=y"
        />
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-full">
      <h2 className="text-lg font-semibold">
        トラックボール設定{" "}
        {selectedProcessor && (
          <span className="text-sm font-normal text-base-content/60">
            ({selectedProcessor.name})
          </span>
        )}
      </h2>

      <TrackballPrecisionSettings />

      <section className="rounded-xl border border-orange-200 bg-white p-3 shadow-sm space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">スクロールするレイヤー</span>
          <select value={visibleScrollLayerId ?? ""} onChange={(event) => { const layerId = event.target.value === "" ? null : Number(event.target.value); setScrollLayerId(layerId); setScrollMask(layerId === null ? 0 : encodeScrollLayerMask(layers.find((layer) => layer.id === layerId)!)); setScrollTouched(true); setScrollWarning(null); }} className="rounded px-2 py-1 bg-base-100 border border-base-300">
            <option value="">なし</option>
            {layers.map((layer) => <option key={layer.id} value={layer.id} disabled={layer.index > 31}>{layer.name}{layer.index > 31 ? " (選択不可)" : ""}</option>)}
          </select>
        </label>
        {visibleScrollWarning && <p role="alert" className="text-sm text-warning">{visibleScrollWarning}</p>}
        <label className="flex items-center gap-2 text-sm">
          <input aria-label="Auto Mouseを有効にする" type="checkbox" checked={autoMouseEnabled} onChange={(event) => setAutoMouseEnabled(event.target.checked)} />
          Auto Mouseを有効にする
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Auto Mouseレイヤー</span>
          <select aria-label="Auto Mouseレイヤー" value={autoMouseLayerId ?? ""} onChange={(event) => setAutoMouseLayerId(event.target.value === "" ? null : Number(event.target.value))} className="rounded px-2 py-1 bg-base-100 border border-base-300">
            {layers.filter((layer) => Number.isInteger(layer.id) && layer.id >= 0).map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">ボール停止後に戻るまで</span>
          <input aria-label="ボール停止後に戻るまで" type="number" min={100} max={5000} step={50} value={autoMouseDeactivationDelayMs} onChange={(event) => setAutoMouseDeactivationDelayMs(Math.min(5000, Math.max(100, Number(event.target.value) || 100)))} className="rounded px-2 py-1 bg-base-100 border border-base-300" />
        </label>
      </section>

      {/* Processor selector (if multiple) */}
      {processors.length > 1 && (
        <section className="flex gap-2">
          {processors.map((p) => (
            <Button
              key={p.id}
              className={`rounded px-3 py-1 text-sm ${selectedId === p.id ? "bg-primary text-primary-content" : "bg-base-300"}`}
              isDisabled={saving}
              onPress={() => {
                if (saving) return;
                requestGeneration.current++;
                setSelectedId(p.id);
                applyProcessorInfo(p);
              }}
            >
              {p.name}
            </Button>
          ))}
        </section>
      )}

      {processors.length === 0 && (
        <p className="text-base-content/50 text-sm">プロセッサ検出中...</p>
      )}

      {/* Speed */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-base-content/70">
          速度
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-base-content/50 w-8">0.2x</span>
          <input
            type="range"
            min={0.2}
            max={5}
            step={0.1}
            value={speedValue}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="text-xs text-base-content/50 w-8">5.0x</span>
        </div>
        <p className="text-sm font-medium text-center">
          {speedValue.toFixed(1)}x
        </p>
      </section>

      {/* Rotation */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-base-content/70">回転角度</h3>
        <label className="flex flex-col gap-1">
          <span className="text-sm">度</span>
          <input
            type="number"
            min={-180}
            max={180}
            value={rotation}
            onChange={(e) => setRotation(parseInt(e.target.value) || 0)}
            className="rounded px-2 py-1 bg-base-100 border border-base-300"
          />
        </label>
      </section>

      {/* Axis Controls */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-base-content/70">
          軸の設定
        </h3>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={xInvert}
              onChange={(e) => setXInvert(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">X軸を反転</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={yInvert}
              onChange={(e) => setYInvert(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Y軸を反転</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={xySwap}
              onChange={(e) => setXySwap(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">X/Y軸を入れ替え</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={xyToScroll}
              onChange={(e) => setXyToScroll(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">スクロールモード</span>
          </label>
        </div>
      </section>

      {/* Axis Snapping */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-base-content/70">
          軸スナップ
        </h3>
        <label className="flex flex-col gap-1">
          <span className="text-sm">スナップモード</span>
          <select
            value={axisSnapMode}
            onChange={(e) =>
              setAxisSnapMode(parseInt(e.target.value) as RIP.AxisSnapMode)
            }
            className="rounded px-2 py-1 bg-base-100 border border-base-300"
          >
            <option value={0}>なし</option>
            <option value={1}>X軸</option>
            <option value={2}>Y軸</option>
          </select>
        </label>
        {axisSnapMode !== 0 && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm">しきい値</span>
              <input
                type="number"
                min={0}
                value={axisSnapThreshold}
                onChange={(e) =>
                  setAxisSnapThreshold(parseInt(e.target.value) || 0)
                }
                className="rounded px-2 py-1 bg-base-100 border border-base-300"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">タイムアウト (ms)</span>
              <input
                type="number"
                min={0}
                value={axisSnapTimeout}
                onChange={(e) =>
                  setAxisSnapTimeout(parseInt(e.target.value) || 0)
                }
                className="rounded px-2 py-1 bg-base-100 border border-base-300"
              />
            </label>
          </div>
        )}
      </section>

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          className="rounded bg-primary text-primary-content px-4 py-2 hover:opacity-90 disabled:opacity-50"
          isDisabled={saving}
          onPress={handleApply}
        >
          {saving ? "適用中..." : "適用"}
        </Button>
        <Button
          className="rounded bg-base-300 px-4 py-2 hover:bg-base-200"
          isDisabled={saving}
          onPress={handleReset}
        >
          初期値に戻す
        </Button>
      </div>
    </div>
  );
}

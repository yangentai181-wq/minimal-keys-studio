import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { useCustomSubsystem } from "../rpc/useCustomSubsystem";
import { useToast } from "../misc/Toast";
import { SubsystemUnavailable } from "../misc/SubsystemUnavailable";
import { SettingsCard } from "../misc/SettingsCard";
import { LoadingSkeleton } from "../misc/LoadingSkeleton";
import * as HT from "../proto/holdtap";
import { useDirtyRegistration } from "../navigation/DirtyStateContext";
import { ERROR_MESSAGES } from "../copy/errorMessages";
import { useStudioKeymap } from "../keyboard/useStudioKeymap";
import { useBehaviorList } from "../behaviors/BehaviorsContext";
import { findHoldTapUsages, presentHoldTap } from "./holdtap-presentation";
import { ActionFeedbackLabel } from "../motion/ActionFeedbackLabel";
import { useTransientFeedback } from "../motion/useTransientFeedback";

// -1 as uint32 in protobuf = "not configured in device tree" = effectively 0ms
const SENTINEL = 0xFFFFFFFF;
function sanitizeMs(v: number): number {
  return v >= SENTINEL ? 0 : v;
}

function tappingTermDescription(ms: number): string {
  if (ms <= 120) return "とても速い - 上級者向け";
  if (ms <= 180) return "速い - 慣れた人向け";
  if (ms <= 250) return "標準 - おすすめ";
  if (ms <= 350) return "ゆっくり - 初心者向け";
  return "とてもゆっくり";
}

function msDescription(ms: number): string {
  if (ms === 0) return "無効";
  if (ms <= 100) return "短い";
  if (ms <= 200) return "標準";
  return "長い";
}

type HoldTapDraft = {
  selectedId: number | null;
  tappingTerm: number;
  quickTap: number;
  requirePriorIdle: number;
  flavor: HT.HoldTapFlavor;
};

function holdTapMatchesDraft(info: HT.HoldTapInfo, draft: HoldTapDraft): boolean {
  return info.id === draft.selectedId
    && info.tappingTermMs === draft.tappingTerm
    && sanitizeMs(info.quickTapMs) === draft.quickTap
    && sanitizeMs(info.requirePriorIdleMs) === draft.requirePriorIdle
    && info.flavor === draft.flavor;
}

function sameHoldTapDraft(a: HoldTapDraft, b: HoldTapDraft): boolean {
  return a.selectedId === b.selectedId
    && a.tappingTerm === b.tappingTerm
    && a.quickTap === b.quickTap
    && a.requirePriorIdle === b.requirePriorIdle
    && a.flavor === b.flavor;
}

export function HoldTapSettings() {
  const subsystem = useCustomSubsystem(HT.SUBSYSTEM_ID);
  const { layers } = useStudioKeymap();
  const behaviors = useBehaviorList();
  const { toast } = useToast();
  const [holdTaps, setHoldTaps] = useState<HT.HoldTapInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const feedback = useTransientFeedback(800);
  const [loading, setLoading] = useState(false);
  const [showUnused, setShowUnused] = useState(false);

  // Local form state
  const [tappingTerm, setTappingTerm] = useState(200);
  const [quickTap, setQuickTap] = useState(0);
  const [requirePriorIdle, setRequirePriorIdle] = useState(0);
  const [flavor, setFlavor] = useState<HT.HoldTapFlavor>(0);
  const draftRef = useRef<HoldTapDraft>({ selectedId, tappingTerm, quickTap, requirePriorIdle, flavor });
  draftRef.current = { selectedId, tappingTerm, quickTap, requirePriorIdle, flavor };
  const saveVersionRef = useRef(0);
  const pendingRestoredDraftRef = useRef<HoldTapDraft | null>(null);
  const automaticallySelectedRef = useRef(false);
  const markUserEdit = () => {
    automaticallySelectedRef.current = false;
  };

  const applyDraft = useCallback((draft: HoldTapDraft) => {
    setSelectedId(draft.selectedId);
    setTappingTerm(draft.tappingTerm);
    setQuickTap(draft.quickTap);
    setRequirePriorIdle(draft.requirePriorIdle);
    setFlavor(draft.flavor);
  }, []);

  const discoveryVersionRef = useRef(0);

  const callWithTimeout = useCallback(
    async (label: string, payload: Uint8Array, timeoutMs = 5000) => {
      if (!subsystem) throw new Error("No subsystem");
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`RPC timeout: ${label}`)),
          timeoutMs
        )
      );
      const data = await Promise.race([
        subsystem.callRPC(payload),
        timeout,
      ]);
      const response = HT.decodeResponse(data);
      if (response.error) throw new Error(response.error);
      return response;
    },
    [subsystem]
  );

  // Discover hold-tap instances
  useEffect(() => {
    if (!subsystem) {
      setHoldTaps([]);
      setSelectedId(null);
      return;
    }

    const version = ++discoveryVersionRef.current;

    async function discover() {
      setLoading(true);
      try {
        const resp = await callWithTimeout(
          "listHoldTaps",
          HT.encodeListHoldTaps(),
          15000
        );
        if (version !== discoveryVersionRef.current) return;

        const list = resp.listHoldTaps?.holdTaps ?? [];
        setHoldTaps(list);

        const restored = pendingRestoredDraftRef.current;
        if (restored) {
          applyDraft(restored);
          pendingRestoredDraftRef.current = null;
        }
      } catch (e) {
        if (version === discoveryVersionRef.current) {
          console.error("[HoldTap] Discovery failed:", e);
          toast(ERROR_MESSAGES["holdTap.discover"], "error");
        }
      } finally {
        if (version === discoveryVersionRef.current) setLoading(false);
      }
    }

    discover();
  }, [subsystem, callWithTimeout, toast, applyDraft]);

  function applyInfo(info: HT.HoldTapInfo) {
    setTappingTerm(info.tappingTermMs);
    setQuickTap(sanitizeMs(info.quickTapMs));
    setRequirePriorIdle(sanitizeMs(info.requirePriorIdleMs));
    setFlavor(info.flavor);
  }

  const selected = holdTaps.find((h) => h.id === selectedId) ?? null;
  const instances = holdTaps.map((holdTap) => ({
    holdTap,
    presentation: presentHoldTap(holdTap.name),
    usages: findHoldTapUsages(presentHoldTap(holdTap.name), layers, behaviors),
  }));
  const usedInstances = instances.filter((instance) => instance.usages.length > 0);
  const unusedInstances = instances.filter((instance) => instance.usages.length === 0);
  const selectedInstance = instances.find((instance) => instance.holdTap.id === selectedId) ?? null;
  const usageReady = behaviors.length > 0;

  useEffect(() => {
    if (holdTaps.length === 0) return;
    const initial = selectedId === null
      ? usedInstances[0]?.holdTap ?? (usageReady ? null : holdTaps[0])
      : automaticallySelectedRef.current && usageReady && selectedInstance?.usages.length === 0
        ? usedInstances[0]?.holdTap ?? null
        : null;
    if (!initial) return;
    automaticallySelectedRef.current = true;
    setSelectedId(initial.id);
    applyInfo(initial);
  }, [holdTaps, selectedId, selectedInstance, usageReady, usedInstances]);

  const dirty = !!selected && (tappingTerm !== selected.tappingTermMs || quickTap !== sanitizeMs(selected.quickTapMs) || requirePriorIdle !== sanitizeMs(selected.requirePriorIdleMs) || flavor !== selected.flavor);

  const handleApply = useCallback(async () => {
    feedback.clear();
    if (!subsystem || selectedId === null || !selected) return;
    const version = ++saveVersionRef.current;
    const id = selectedId;
    const submitted: HoldTapDraft = {
      selectedId,
      tappingTerm,
      quickTap,
      requirePriorIdle,
      flavor,
    };
    const confirmed = selected;
    setSaving(true);
    try {
      if (submitted.tappingTerm !== confirmed.tappingTermMs) {
        const response = await callWithTimeout(
          "setTappingTerm",
          HT.encodeSetTappingTerm(id, submitted.tappingTerm)
        );
        if (!response.setTappingTerm?.success) throw new Error("タッピングタームを保存できませんでした");
      }
      if (submitted.quickTap !== sanitizeMs(confirmed.quickTapMs)) {
        const response = await callWithTimeout(
          "setQuickTap",
          HT.encodeSetQuickTap(id, submitted.quickTap)
        );
        if (!response.setQuickTap?.success) throw new Error("クイックタップを保存できませんでした");
      }
      if (submitted.requirePriorIdle !== sanitizeMs(confirmed.requirePriorIdleMs)) {
        const response = await callWithTimeout(
          "setRequirePriorIdle",
          HT.encodeSetRequirePriorIdle(id, submitted.requirePriorIdle)
        );
        if (!response.setRequirePriorIdle?.success) throw new Error("入力前待ち時間を保存できませんでした");
      }
      if (submitted.flavor !== confirmed.flavor) {
        const response = await callWithTimeout(
          "setFlavor",
          HT.encodeSetFlavor(id, submitted.flavor)
        );
        if (!response.setFlavor?.success) throw new Error("判定モードを保存できませんでした");
      }

      const resp = await callWithTimeout(
        "listHoldTaps",
        HT.encodeListHoldTaps()
      );
      if (!resp.listHoldTaps?.holdTaps) throw new Error("Hold-tap list response was missing");
      const updated = resp.listHoldTaps.holdTaps.find(
        (h) => h.id === id
      );
      if (!updated) throw new Error("Hold-tap selected ID was missing from readback");
      if (!holdTapMatchesDraft(updated, submitted)) {
        throw new Error("Hold-tap readback did not match the submitted settings");
      }
      if (version !== saveVersionRef.current) return;
      const draftUnchanged = sameHoldTapDraft(draftRef.current, submitted);
      setHoldTaps(resp.listHoldTaps.holdTaps);
      if (draftUnchanged) {
        applyInfo(updated);
        feedback.trigger();
      }
    } catch (e) {
      if (version === saveVersionRef.current) {
        feedback.clear();
        console.error("[HoldTap] Failed to save:", e);
        toast(ERROR_MESSAGES["holdTap.save"], "error");
      }
      throw e;
    } finally {
      if (version === saveVersionRef.current) setSaving(false);
    }
  }, [
    subsystem,
    selectedId,
    selected,
    tappingTerm,
    quickTap,
    requirePriorIdle,
    flavor,
    callWithTimeout,
    toast,
    feedback,
  ]);

  useDirtyRegistration("holdtap", {
    dirty,
    save: async () => { await handleApply(); return true; },
    discard: async () => {
      if (!selected) return false;
      pendingRestoredDraftRef.current = null;
      applyInfo(selected);
      return true;
    },
    snapshot: (): HoldTapDraft => ({ selectedId, tappingTerm, quickTap, requirePriorIdle, flavor }),
    restore: (snapshot) => {
      const draft = snapshot as HoldTapDraft;
      pendingRestoredDraftRef.current = draft;
      applyDraft(draft);
    },
  });

  const handleReset = useCallback(async () => {
    feedback.clear();
    if (!subsystem || selectedId === null) return;
    setSaving(true);
    try {
      await callWithTimeout(
        "resetHoldTap",
        HT.encodeResetHoldTap(selectedId)
      );
      // Reload to confirm
      const resp = await callWithTimeout(
        "listHoldTaps",
        HT.encodeListHoldTaps()
      );
      if (resp.listHoldTaps?.holdTaps) {
        setHoldTaps(resp.listHoldTaps.holdTaps);
        const updated = resp.listHoldTaps.holdTaps.find(
          (h) => h.id === selectedId
        );
        if (updated) applyInfo(updated);
      }
    } catch (e) {
      feedback.clear();
      console.error("[HoldTap] Failed to reset:", e);
      toast(ERROR_MESSAGES["holdTap.reset"], "error");
    } finally {
      setSaving(false);
    }
  }, [subsystem, selectedId, callWithTimeout, toast, feedback]);

  if (!subsystem) {
    return (
      <SubsystemUnavailable
        featureName="長押し設定"
        explanation="キーボードのファームウェアがこの機能に対応していないか、接続方法を確認してください。"
        technicalDetails="CONFIG_ZMK_RUNTIME_HOLD_TAP=y, CONFIG_ZMK_RUNTIME_HOLD_TAP_STUDIO_RPC=y"
      />
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-full">
      <h2 className="text-lg font-semibold">
        長押し設定
        {selected && (
          <span className="text-sm font-normal text-base-content/60 ml-2">
            ({selectedInstance?.presentation.title ?? selected.name})
          </span>
        )}
      </h2>

      {/* Instance selector */}
      {(holdTaps.length > 1 || (usageReady && unusedInstances.length > 0)) && (
        <section className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
          {usedInstances.map(({ holdTap, presentation, usages }) => (
            <Button
              key={holdTap.id}
              className={`rounded-md px-3 py-1.5 text-sm transition-all ${
                selectedId === holdTap.id
                  ? "bg-primary text-primary-content"
                  : "bg-base-200 hover:bg-base-300"
              }`}
              onPress={() => {
                automaticallySelectedRef.current = false;
                setSelectedId(holdTap.id);
                applyInfo(holdTap);
              }}
            >
              {presentation.title}（{usages.length}キー）
            </Button>
          ))}
          </div>
          {unusedInstances.length > 0 && !showUnused && (
            <Button className="text-sm text-primary self-start" onPress={() => setShowUnused(true)}>
              未使用の設定を表示
            </Button>
          )}
          {showUnused && (
            <div className="flex gap-2 flex-wrap">
              {unusedInstances.map(({ holdTap, presentation }) => (
                <Button
                  key={holdTap.id}
                  className={`rounded-md px-3 py-1.5 text-sm transition-all ${selectedId === holdTap.id ? "bg-primary text-primary-content" : "bg-base-200 hover:bg-base-300"}`}
                  onPress={() => { automaticallySelectedRef.current = false; setSelectedId(holdTap.id); applyInfo(holdTap); }}
                >
                  {presentation.title}（0キー）
                </Button>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedInstance && (
        <p className="text-sm text-base-content/60">
          {selectedInstance.usages.length}キーで使用中
          {selectedInstance.usages.length > 0 && `: ${selectedInstance.usages.map((usage) => `${usage.layerName} / ${usage.keyLabel}`).join("、")}`}
        </p>
      )}

      {holdTaps.length === 0 && !loading && (
        <p className="text-base-content/50 text-sm">
          長押し設定の対象が見つかりません。
        </p>
      )}

      {loading && <LoadingSkeleton lines={4} />}

      {selected && !loading && (
        <>
          <SettingsCard
            title="長押し判定までの時間"
            description="押してから長押しになるまで"
            defaultNote={`初期値: ${selected.defaultTappingTermMs}ms`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-base-content/50 w-10">速い</span>
              <input
                type="range"
                min={50}
                max={500}
                step={10}
                value={tappingTerm}
                onChange={(e) => {
                  markUserEdit();
                  setTappingTerm(parseInt(e.target.value));
                }}
                className="flex-1 accent-primary"
              />
              <span className="text-xs text-base-content/50 w-10 text-right">遅い</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-base-content/40">
                {tappingTermDescription(tappingTerm)}
              </span>
              <span className="text-sm font-medium tabular-nums">{tappingTerm}ms</span>
            </div>
          </SettingsCard>

          <SettingsCard
            title="連打を単押しにする時間"
            description="素早く連打した時に単押しとして扱う範囲"
            defaultNote={`初期値: ${sanitizeMs(selected.defaultQuickTapMs)}ms`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-base-content/50 w-10">無効</span>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={quickTap}
                onChange={(e) => {
                  markUserEdit();
                  setQuickTap(parseInt(e.target.value));
                }}
                className="flex-1 accent-primary"
              />
              <span className="text-xs text-base-content/50 w-10 text-right">長い</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-base-content/40">
                {msDescription(quickTap)}
              </span>
              <span className="text-sm font-medium tabular-nums">{quickTap}ms</span>
            </div>
          </SettingsCard>

          <SettingsCard
            title="直前の入力を待つ時間"
            description="前のキー操作直後の誤長押しを防ぐ時間"
            defaultNote={`初期値: ${sanitizeMs(selected.defaultRequirePriorIdleMs)}ms`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-base-content/50 w-10">無効</span>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={requirePriorIdle}
                onChange={(e) => {
                  markUserEdit();
                  setRequirePriorIdle(parseInt(e.target.value));
                }}
                className="flex-1 accent-primary"
              />
              <span className="text-xs text-base-content/50 w-10 text-right">長い</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-base-content/40">
                {msDescription(requirePriorIdle)}
              </span>
              <span className="text-sm font-medium tabular-nums">{requirePriorIdle}ms</span>
            </div>
          </SettingsCard>

          <SettingsCard
            title="判定方法"
            description="他のキーを押した時に単押し／長押しをどう決めるか"
            defaultNote={`初期値: ${HT.FLAVOR_LABELS[selected.defaultFlavor] ?? "不明"}`}
          >
            <select
              value={flavor}
              onChange={(e) => {
                markUserEdit();
                setFlavor(parseInt(e.target.value) as HT.HoldTapFlavor);
              }}
              className="w-full rounded-md px-2 py-1.5 bg-base-100 border border-base-300"
            >
              {Object.entries(HT.FLAVOR_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </SettingsCard>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              className="rounded-md bg-primary text-primary-content px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
              isDisabled={saving}
              onPress={handleApply}
            >
              <ActionFeedbackLabel idleLabel="適用" pendingLabel="適用中..." successLabel="適用済み" pending={saving} success={feedback.active} />
            </Button>
            <Button
              className="rounded-md bg-base-200 px-4 py-2 hover:bg-base-300 transition-colors"
              onPress={handleReset}
            >
              初期値に戻す
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

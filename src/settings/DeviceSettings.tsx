import { useCallback, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { SubsystemUnavailable } from "../misc/SubsystemUnavailable";
import { Switch } from "../misc/Switch";
import {
  useCustomSubsystem,
  useCustomNotification,
} from "../rpc/useCustomSubsystem";
import { useToast } from "../misc/Toast";
import * as SETTINGS from "../proto/settings";
import { useTelemetry } from "../telemetry/TelemetryProvider";
import { ERROR_MESSAGES } from "../copy/errorMessages";
import { ActionFeedbackLabel } from "../motion/ActionFeedbackLabel";
import { useTransientFeedback } from "../motion/useTransientFeedback";

function requireSettingsAcknowledgement(
  data: Uint8Array,
  field: "setActivitySettings" | "getAllActivitySettings",
  label: string,
): void {
  const response = SETTINGS.decodeResponse(data);
  if (response.error) throw new Error(response.error);
  if (response[field] !== true) throw new Error(`${label} acknowledgement was missing or false`);
}

export function DeviceSettings() {
  const { toast } = useToast();
  const { isOptedIn, setOptedIn } = useTelemetry();
  const subsystem = useCustomSubsystem(SETTINGS.SUBSYSTEM_ID);
  const [deviceSettings, setDeviceSettings] = useState<
    Map<number, SETTINGS.ActivitySettings>
  >(new Map());
  const [idleSeconds, setIdleSeconds] = useState(30);
  const [sleepMinutes, setSleepMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const feedbackActive = useTransientFeedback(800);
  const [feedback, setFeedback] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const editVersionRef = useRef(0);
  const operationVersionRef = useRef(0);
  const draftDirtyRef = useRef(false);
  const expectedCentralRef = useRef<Pick<SETTINGS.ActivitySettings, "idleMs" | "sleepMs"> | null>(null);
  const centralGuardActiveRef = useRef(false);

  // Listen for settings notifications from all devices
  useCustomNotification(subsystem?.subsystemIndex, (payload) => {
    const notif = SETTINGS.decodeNotification(payload);
    if (notif.activitySettings) {
      const s = notif.activitySettings;
      setDeviceSettings((prev) => {
        const next = new Map(prev);
        next.set(s.source, s);
        return next;
      });
      // Use central settings (source=0) for form defaults
      if (s.source === 0 && !draftDirtyRef.current) {
        const expected = expectedCentralRef.current;
        const matchesExpected = expected === null
          || (s.idleMs === expected.idleMs && s.sleepMs === expected.sleepMs);
        if (!centralGuardActiveRef.current || matchesExpected) {
          expectedCentralRef.current = { idleMs: s.idleMs, sleepMs: s.sleepMs };
          setIdleSeconds(Math.round(s.idleMs / 1000));
          setSleepMinutes(Math.round(s.sleepMs / 60000));
        }
      }
    }
  });

  // Auto-fetch on connect
  const prevSubsystem = useRef(subsystem);
  if (subsystem && !prevSubsystem.current && !loadedRef.current) {
    loadedRef.current = true;
    subsystem
      .callRPC(SETTINGS.encodeGetAllActivitySettings())
      .then((data) => requireSettingsAcknowledgement(data, "getAllActivitySettings", "Get-all settings"))
      .catch((e: unknown) => {
        console.error("Failed to request all activity settings:", e);
        toast(ERROR_MESSAGES["device.loadSettings"], "error");
      });
  }
  if (!subsystem) loadedRef.current = false;
  prevSubsystem.current = subsystem;

  const allSettings = Array.from(deviceSettings.values()).sort(
    (a, b) => a.source - b.source
  );
  const outOfSync =
    allSettings.length > 1 &&
    allSettings.some(
      (s) =>
        s.idleMs !== allSettings[0].idleMs ||
        s.sleepMs !== allSettings[0].sleepMs
    );

  const handleApply = useCallback(async () => {
    feedbackActive.clear();
    if (!subsystem) return;
    const operationVersion = ++operationVersionRef.current;
    const submittedEditVersion = editVersionRef.current;
    const submittedIdleSeconds = idleSeconds;
    const submittedSleepMinutes = sleepMinutes;
    setSaving(true);
    setFeedback(null);
    try {
      const setResponse = await subsystem.callRPC(
        SETTINGS.encodeSetActivitySettings({
          idleMs: submittedIdleSeconds * 1000,
          sleepMs: submittedSleepMinutes * 60000,
          source: 0,
        })
      );
      requireSettingsAcknowledgement(setResponse, "setActivitySettings", "Set settings");
      // Reload all settings
      const getAllResponse = await subsystem.callRPC(SETTINGS.encodeGetAllActivitySettings());
      requireSettingsAcknowledgement(getAllResponse, "getAllActivitySettings", "Get-all settings");
      if (operationVersion !== operationVersionRef.current || submittedEditVersion !== editVersionRef.current) return;
      expectedCentralRef.current = {
        idleMs: submittedIdleSeconds * 1000,
        sleepMs: submittedSleepMinutes * 60000,
      };
      centralGuardActiveRef.current = true;
      draftDirtyRef.current = false;
      feedbackActive.trigger();
      setFeedback("設定を適用しました");
    } catch (e) {
      if (operationVersion === operationVersionRef.current) {
        feedbackActive.clear();
        console.error("Failed to apply settings:", e);
        toast(ERROR_MESSAGES["device.applySettings"], "error");
        if (submittedEditVersion === editVersionRef.current) {
          setFeedback("設定の適用に失敗しました");
        }
      }
    } finally {
      if (operationVersion === operationVersionRef.current) setSaving(false);
    }
  }, [subsystem, idleSeconds, sleepMinutes, toast, feedbackActive]);

  const handleSync = useCallback(async () => {
    feedbackActive.clear();
    if (!subsystem) return;
    const operationVersion = ++operationVersionRef.current;
    const submittedEditVersion = editVersionRef.current;
    const submittedIdleSeconds = idleSeconds;
    const submittedSleepMinutes = sleepMinutes;
    setSaving(true);
    setFeedback(null);
    try {
      // Apply current settings to all devices
      for (const s of allSettings) {
        const setResponse = await subsystem.callRPC(
          SETTINGS.encodeSetActivitySettings({
            idleMs: submittedIdleSeconds * 1000,
            sleepMs: submittedSleepMinutes * 60000,
            source: s.source,
          })
        );
        requireSettingsAcknowledgement(setResponse, "setActivitySettings", "Set settings");
      }
      const getAllResponse = await subsystem.callRPC(SETTINGS.encodeGetAllActivitySettings());
      requireSettingsAcknowledgement(getAllResponse, "getAllActivitySettings", "Get-all settings");
      if (operationVersion !== operationVersionRef.current || submittedEditVersion !== editVersionRef.current) return;
      expectedCentralRef.current = {
        idleMs: submittedIdleSeconds * 1000,
        sleepMs: submittedSleepMinutes * 60000,
      };
      centralGuardActiveRef.current = true;
      draftDirtyRef.current = false;
      setFeedback("全デバイスに同期しました");
    } catch (e) {
      if (operationVersion === operationVersionRef.current) {
        feedbackActive.clear();
        console.error("Failed to sync settings:", e);
        toast(ERROR_MESSAGES["device.syncSettings"], "error");
        if (submittedEditVersion === editVersionRef.current) {
          setFeedback("同期に失敗しました");
        }
      }
    } finally {
      if (operationVersion === operationVersionRef.current) setSaving(false);
    }
  }, [subsystem, idleSeconds, sleepMinutes, allSettings, toast, feedbackActive]);

  if (!subsystem) {
    return (
      <SubsystemUnavailable
        featureName="デバイス設定"
        explanation="キーボードのファームウェアがこの機能に対応していないか、接続方法を確認してください。"
        technicalDetails="CONFIG_ZMK_SETTINGS_RPC_STUDIO=y"
      />
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-full">
      <h2 className="text-lg font-semibold">デバイス設定</h2>

      {/* Sync Warning */}
      {outOfSync && (
        <div className="rounded-lg border border-warning bg-warning/10 p-3 flex items-center justify-between">
          <p className="text-sm text-warning">
            デバイス間で設定が同期されていません。
          </p>
          <Button
            className="rounded bg-warning text-warning-content px-3 py-1 text-sm"
            isDisabled={saving}
            onPress={handleSync}
          >
            全デバイスに同期
          </Button>
        </div>
      )}

      {/* Idle Timeout */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-base-content/70">
          アイドルタイムアウト
        </h3>
        <p className="text-sm text-base-content/50">
          アイドルモード（LED消灯）に移行するまでの時間。0で無効化。
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={5}
            value={idleSeconds}
            onChange={(e) => {
              centralGuardActiveRef.current = true;
              draftDirtyRef.current = true;
              editVersionRef.current += 1;
              feedbackActive.clear();
              setFeedback(null);
              setIdleSeconds(parseInt(e.target.value) || 0);
            }}
            className="rounded px-2 py-1 bg-base-100 border border-base-300 w-24"
          />
          <span className="text-sm text-base-content/60">秒</span>
        </div>
      </section>

      {/* Sleep Timeout */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-base-content/70">
          スリープタイムアウト
        </h3>
        <p className="text-sm text-base-content/50">
          ディープスリープに移行するまでの時間。0で無効化。
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={1}
            value={sleepMinutes}
            onChange={(e) => {
              centralGuardActiveRef.current = true;
              draftDirtyRef.current = true;
              editVersionRef.current += 1;
              feedbackActive.clear();
              setFeedback(null);
              setSleepMinutes(parseInt(e.target.value) || 0);
            }}
            className="rounded px-2 py-1 bg-base-100 border border-base-300 w-24"
          />
          <span className="text-sm text-base-content/60">分</span>
        </div>
      </section>

      {/* Per-Device Info */}
      {allSettings.length > 0 && (
        <section className="flex flex-col gap-2 pt-2 border-t border-base-300">
          <h3 className="text-sm font-medium text-base-content/70">
            デバイス状態
          </h3>
          {allSettings.map((s) => (
            <div
              key={s.source}
              className="text-xs text-base-content/50 flex gap-4"
            >
              <span>
                {s.source === 0 ? "右手 (R)" : "左手 (L)"}
              </span>
              <span>アイドル: {Math.round(s.idleMs / 1000)}秒</span>
              <span>スリープ: {Math.round(s.sleepMs / 60000)}分</span>
            </div>
          ))}
        </section>
      )}

      {/* Apply Button */}
      <div className="flex gap-2 pt-2">
        <Button
          className="rounded bg-primary text-primary-content px-4 py-2 hover:opacity-90 disabled:opacity-50"
          isDisabled={saving}
          onPress={handleApply}
        >
          <ActionFeedbackLabel idleLabel="適用" pendingLabel="適用中..." successLabel="適用済み" pending={saving} success={feedbackActive.active} />
        </Button>
      </div>

      {/* Feedback */}
      {feedback && <p className="text-sm text-success">{feedback}</p>}

      {/* Telemetry (Tauri only) */}
      {window.__TAURI_INTERNALS__ && (
        <section className="flex flex-col gap-2 pt-4 border-t border-base-300">
          <h3 className="text-sm font-medium text-base-content/70">
            利用データの送信
          </h3>
          <Switch
            isSelected={isOptedIn}
            onChange={setOptedIn}
            label={isOptedIn ? "送信する" : "送信しない"}
            description="匿名の操作ログ・エラー情報・キーマップ設定を開発者に送信します"
          />
        </section>
      )}
    </div>
  );
}

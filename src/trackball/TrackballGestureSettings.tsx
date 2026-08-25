import { useState } from "react";
import { BehaviorBindingPicker } from "../behaviors/BehaviorBindingPicker";
import { getBehaviorDescription } from "../behaviors/behavior-descriptions";
import { formatBindingDetail } from "../behaviors/binding-display";
import { GESTURE_LAYER_INDEX } from "../keyboard/minimal-keys-layers";
import { GESTURE_DIRECTIONS, getGestureBinding, type GestureDirection } from "./gesture-bindings";
import { useConnectedGestureKeymap } from "./useConnectedGestureKeymap";

const STATUS_MESSAGES = {
  loading: "設定を読み込んでいます…",
  disconnected: "キーボードに接続すると設定できます",
  "firmware-update-required": "ファームウェアの更新が必要です",
  error: "設定を読み込むか更新できませんでした",
  available: "利用可能",
} as const;

export function TrackballGestureSettings() {
  const { availability, keymap, behaviors, updateBinding } = useConnectedGestureKeymap();
  const [selectedDirection, setSelectedDirection] = useState<GestureDirection>("up");
  const [announcement, setAnnouncement] = useState("選択中: 上フリック");
  const visibleLayers = keymap?.layers
    .map((layer, index) => ({ ...layer, index }))
    .filter(({ index }) => index !== GESTURE_LAYER_INDEX) ?? [];
  const selectedBinding = keymap ? getGestureBinding(keymap, selectedDirection) : null;

  const bindingLabel = (direction: GestureDirection): string => {
    if (!keymap) return "不明な操作";
    const binding = getGestureBinding(keymap, direction);
    if (!binding) return "不明な操作";
    const behavior = behaviors.find((candidate) => candidate.id === binding.behaviorId);
    if (!behavior) return "不明な操作";
    if (behavior.displayName === "None") return "何もしない";
    const description = getBehaviorDescription(behavior.displayName);
    const detail = formatBindingDetail(behavior.displayName, binding, visibleLayers);
    return detail ? `${description.label}: ${detail}` : description.label;
  };

  const selectDirection = (direction: GestureDirection) => {
    setSelectedDirection(direction);
    setAnnouncement(`選択中: ${GESTURE_DIRECTIONS.find((candidate) => candidate.id === direction)?.label}フリック`);
  };

  return (
    <section data-testid="gesture-settings" aria-labelledby="trackball-gesture-title" className="space-y-4 rounded-xl border border-primary/20 bg-white p-4 shadow-sm">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="trackball-gesture-title" className="text-base font-bold">ジェスチャー</h3>
          <span className="rounded border border-base-300 bg-base-100 px-2 py-0.5 text-xs text-base-content/70">キーボード共通</span>
          {availability === "available" && <span className="rounded border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-base-content/70">{STATUS_MESSAGES.available}</span>}
        </div>
        <p className="text-sm text-base-content/70">I と O を同時押しするとジェスチャーモードが切り替わります。</p>
        <p className="text-sm text-base-content/70">モード中にボールを上下左右へはじくと、設定した操作を実行します。</p>
        <p className="text-sm text-base-content/70">起動キー: I + O（固定）</p>
      </header>

      {availability !== "available" ? (
        <p role="status" className="text-sm text-base-content/70">{STATUS_MESSAGES[availability]}</p>
      ) : selectedBinding ? (
        <>
          <div role="group" aria-label="フリック方向" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {GESTURE_DIRECTIONS.map((direction) => {
              const selected = selectedDirection === direction.id;
              return (
                <button
                  key={direction.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectDirection(direction.id)}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${selected ? "border-primary bg-primary/10" : "border-base-300 bg-base-100"}`}
                >
                  <span aria-hidden="true" className="mr-2">{direction.arrow}</span>
                  <span className="font-medium">{direction.label}</span>
                  {selected && <span className="ml-2 text-xs font-medium">選択中</span>}
                  <span className="ml-2 text-base-content/70">{bindingLabel(direction.id)}</span>
                </button>
              );
            })}
          </div>
          <BehaviorBindingPicker
            binding={selectedBinding}
            behaviors={behaviors}
            layers={visibleLayers}
            onBindingChanged={async (binding) => {
              const directionLabel = GESTURE_DIRECTIONS.find((candidate) => candidate.id === selectedDirection)?.label;
              try {
                const updated = await updateBinding(selectedDirection, binding);
                setAnnouncement(updated
                  ? `${directionLabel}フリックの割当を変更しました`
                  : `${directionLabel}フリックの割当を変更できませんでした`);
              } catch {
                setAnnouncement(`${directionLabel}フリックの割当を変更できませんでした`);
              }
            }}
          />
        </>
      ) : (
        <p role="status" className="text-sm text-base-content/70">設定を読み込んでいます…</p>
      )}
      <p data-testid="gesture-announcement" aria-live="polite" className="text-sm text-base-content/70">{announcement}</p>
    </section>
  );
}

import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { PhysicalLayout, type KeyPosition } from "../keyboard/PhysicalLayout";
import { MINIMAL_KEYS_POSITIONS } from "../keyboard/minimal-keys-layout";
import type { TrackballConfig } from "../proto/trackball-settings";
import { analyzePrecisionBinding, type PrecisionBindingAnalysis } from "./precision-binding";
import type { ConnectedPrecisionSelection } from "./useConnectedPrecisionSelection";

interface PrecisionKeyPickerProps {
  keymap: Keymap;
  behaviors: GetBehaviorDetailsResponse[];
  confirmed: TrackballConfig | null;
  draftPosition: number;
  updateDraft(patch: { selectedPosition: number }): void;
  onAnalysis?(analysis: PrecisionBindingAnalysis): void;
}

function analysisForConfirmed(
  confirmed: TrackballConfig | null,
  bindings: Keymap["layers"][number]["bindings"],
  behaviors: GetBehaviorDetailsResponse[],
): PrecisionBindingAnalysis | null {
  if (!confirmed || !confirmed.enabled) return null;
  const binding = confirmed.originalBinding ?? bindings[confirmed.selectedPosition];
  return binding ? analyzePrecisionBinding(binding, behaviors, confirmed.selectedPosition) : null;
}

export function PrecisionKeyPicker({ keymap, behaviors, confirmed, draftPosition, updateDraft }: PrecisionKeyPickerProps) {
  const baseLayer = keymap.layers.find((layer) => layer.id === 0);
  if (!baseLayer) {
    return <p role="status">ベースレイヤーを読み込めません</p>;
  }

  const physicalBindings = baseLayer.bindings.slice(0, MINIMAL_KEYS_POSITIONS.length);
  const displayBindings = physicalBindings.map((binding, position) =>
    confirmed?.enabled && draftPosition === confirmed.selectedPosition && confirmed.selectedPosition === position && confirmed.originalBinding
      ? confirmed.originalBinding
      : binding,
  );
  const analyses = displayBindings.map((binding, position) => analyzePrecisionBinding(binding, behaviors, position));
  const current = confirmed?.enabled && draftPosition === confirmed.selectedPosition
    ? analysisForConfirmed(confirmed, displayBindings, behaviors)
    : analyses[draftPosition] ?? null;
  const positions: KeyPosition[] = MINIMAL_KEYS_POSITIONS.slice(0, physicalBindings.length).map((position, index) => ({
    ...position,
    x: position.x / 100,
    y: position.y / 100,
    width: position.width / 100,
    height: position.height / 100,
    header: analyses[index]?.supported ? "選択可" : "使用不可",
    children: <span>キー {index}{analyses[index]?.supported ? "" : `（${analyses[index]?.reason}）`}</span>,
  }));

  return (
    <section aria-labelledby="precision-key-picker-title" className="space-y-3">
      <h3 id="precision-key-picker-title" className="text-base font-bold">精密モードキー</h3>
      <p>タップ動作は残り、長押し動作は精密モードに置き換わります</p>
      {current?.supported && (
        <dl className="text-sm">
          <div><dt className="sr-only">タップ動作</dt><dd>タップ: {current.tapLabel}</dd></div>
          <div><dt className="sr-only">長押し動作</dt><dd>長押し: {current.holdLabel}</dd></div>
        </dl>
      )}
      <div className="overflow-x-auto" aria-label="精密モードに使うキー">
        <PhysicalLayout
          positions={positions}
          positionStates={Object.fromEntries(analyses.map((analysis, position) => [position, {
            selected: position === draftPosition,
            disabled: !analysis.supported,
            describedBy: analysis.supported ? undefined : `precision-key-reason-${position}`,
          }]))}
          onPositionClicked={(position) => {
            if (analyses[position]?.supported) updateDraft({ selectedPosition: position });
          }}
        />
      </div>
      <ul className="text-sm" aria-live="polite">
        {analyses.map((analysis, position) => !analysis.supported && (
          <li id={`precision-key-reason-${position}`} key={position}>キー {position}: <span>{analysis.reason}</span></li>
        ))}
      </ul>
    </section>
  );
}

export function ConnectedPrecisionKeyPicker({ selection, confirmed, draftPosition, updateDraft }: {
  selection: ConnectedPrecisionSelection;
  confirmed: TrackballConfig | null;
  draftPosition: number;
  updateDraft(patch: { selectedPosition: number }): void;
}) {
  const { keymap, behaviors } = selection;
  if (!keymap || behaviors.length === 0) return null;
  return (
    <PrecisionKeyPicker
      keymap={keymap}
      behaviors={behaviors}
      confirmed={confirmed}
      draftPosition={draftPosition}
      updateDraft={updateDraft}
    />
  );
}

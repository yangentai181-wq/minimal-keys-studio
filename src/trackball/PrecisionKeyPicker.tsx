import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { PhysicalLayout } from "../keyboard/PhysicalLayout";
import { MINIMAL_KEYS_POSITIONS } from "../keyboard/minimal-keys-layout";
import type { TrackballConfig } from "../proto/trackball-settings";
import { useBehaviorList } from "../behaviors/BehaviorsContext";
import { useConnectedDeviceData } from "../rpc/useConnectedDeviceData";
import { analyzePrecisionBinding, type PrecisionBindingAnalysis } from "./precision-binding";
import { useTrackballPrecision } from "./TrackballPrecisionContext";

interface PrecisionKeyPickerProps {
  keymap: Keymap;
  behaviors: GetBehaviorDetailsResponse[];
  confirmed: TrackballConfig | null;
  draftPosition: number;
  updateDraft(patch: { selectedPosition: number }): void;
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
  const baseLayer = keymap.layers.find((layer) => layer.id === 0) ?? keymap.layers[0];
  if (!baseLayer) return null;

  const analyses = baseLayer.bindings.map((binding, position) => analyzePrecisionBinding(binding, behaviors, position));
  const current = analysisForConfirmed(confirmed, baseLayer.bindings, behaviors) ?? analyses[draftPosition] ?? null;
  const positions = MINIMAL_KEYS_POSITIONS.slice(0, baseLayer.bindings.length).map((position, index) => ({
    ...position,
    x: position.x / 100,
    y: position.y / 100,
    width: position.width / 100,
    height: position.height / 100,
    header: analyses[index]?.supported ? "選択可" : "使用不可",
    children: <span>{index}</span>,
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
      <div aria-hidden="true" className="overflow-x-auto">
        <PhysicalLayout positions={positions} selectedPosition={draftPosition} />
      </div>
      <div role="group" aria-label="精密モードに使うキー" className="sr-only">
        {analyses.map((analysis, position) => (
          <button
            key={position}
            type="button"
            aria-pressed={position === draftPosition}
            aria-describedby={analysis.supported ? undefined : `precision-key-reason-${position}`}
            disabled={!analysis.supported}
            onClick={() => updateDraft({ selectedPosition: position })}
          >
            キー {position}
          </button>
        ))}
      </div>
      <ul className="text-sm" aria-live="polite">
        {analyses.map((analysis, position) => !analysis.supported && (
          <li id={`precision-key-reason-${position}`} key={position}>キー {position}: <span>{analysis.reason}</span></li>
        ))}
      </ul>
    </section>
  );
}

export function ConnectedPrecisionKeyPicker() {
  const [keymap] = useConnectedDeviceData<Keymap>(
    { keymap: { getKeymap: true } },
    (response) => response.keymap?.getKeymap,
    true,
  );
  const behaviors = useBehaviorList();
  const { confirmed, draft, updateDraft } = useTrackballPrecision();

  if (!keymap || !draft || behaviors.length === 0) return null;
  return (
    <PrecisionKeyPicker
      keymap={keymap}
      behaviors={behaviors}
      confirmed={confirmed}
      draftPosition={draft.selectedPosition}
      updateDraft={updateDraft}
    />
  );
}

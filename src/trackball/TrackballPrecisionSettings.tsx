import { Button } from "react-aria-components";
import { ConnectedPrecisionKeyPicker } from "./PrecisionKeyPicker";
import { useTrackballPrecision } from "./TrackballPrecisionContext";
import { useConnectedPrecisionSelection } from "./useConnectedPrecisionSelection";
import { validateDraft } from "./precision-state";

const MIN_CPI = 200;
const MAX_CPI = 3200;
const CPI_STEP = 200;

export function TrackballPrecisionSettings() {
  const { availability, confirmed, draft, dirty, saving, error, updateDraft, save } = useTrackballPrecision();
  const selection = useConnectedPrecisionSelection();
  const validationError = draft ? validateDraft(draft) : null;
  const unavailable = availability !== "available";
  const selectionError = draft?.enabled && (!selection.analysis || !selection.analysis.supported)
    ? selection.analysis && !selection.analysis.supported ? selection.analysis.reason : "選んだキーを確認しています"
    : null;
  const saveDisabled = unavailable || !draft || !dirty || saving || validationError !== null || selectionError !== null;

  return (
    <section aria-labelledby="trackball-precision-title" className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm space-y-4">
      <div>
        <h3 id="trackball-precision-title" className="text-base font-bold">精密モード</h3>
        <p className="text-sm text-base-content/70">通常時と精密モード時の速さ、使うキーを設定します。</p>
      </div>
      {unavailable ? (
        <p role="status" className="text-sm text-base-content/70">ファームウェアの更新が必要です</p>
      ) : draft ? (
        <>
          <CpiControl label="通常の速さ" value={draft.normalCpi} onChange={(normalCpi) => updateDraft({ normalCpi })} />
          <CpiControl label="精密モードの速さ" value={draft.precisionCpi} onChange={(precisionCpi) => updateDraft({ precisionCpi })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => updateDraft({ enabled: event.target.checked })}
            />
            精密モードを使う
          </label>
          {draft.enabled && <ConnectedPrecisionKeyPicker selection={selection} confirmed={confirmed} draftPosition={draft.selectedPosition} updateDraft={updateDraft} />}
        </>
      ) : (
        <p role="status" className="text-sm text-base-content/70">設定を読み込んでいます…</p>
      )}
      {(validationError ?? selectionError ?? error) && <p role="alert" className="text-sm text-error">{validationError ?? selectionError ?? error}</p>}
      {confirmed && <p className="text-xs text-base-content/50">確認済み: 通常 {confirmed.normalCpi} CPI / 精密 {confirmed.precisionCpi} CPI</p>}
      <div className="flex justify-end">
        <Button onPress={() => void save()} isDisabled={saveDisabled} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-content disabled:cursor-not-allowed disabled:opacity-40">
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>
    </section>
  );
}

function CpiControl({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}: {value} CPI</span>
      <input
        aria-label={label}
        type="range"
        min={MIN_CPI}
        max={MAX_CPI}
        step={CPI_STEP}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-primary"
      />
    </label>
  );
}

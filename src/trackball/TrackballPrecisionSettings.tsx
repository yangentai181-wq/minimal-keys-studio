import { Button } from "react-aria-components";
import { ConnectedPrecisionKeyPicker } from "./PrecisionKeyPicker";
import { useTrackballPrecision } from "./TrackballPrecisionContext";
import { useConnectedPrecisionSelection } from "./useConnectedPrecisionSelection";
import { validateDraft } from "./precision-state";
import { useDirtyRegistration } from "../navigation/DirtyStateContext";

const MIN_CPI = 200;
const MAX_CPI = 3200;
const CPI_STEP = 200;

export function TrackballPrecisionSettings() {
  const { availability, confirmed, draft, dirty, saving, error, updateDraft, save, reload } = useTrackballPrecision();
  const validationError = draft ? validateDraft(draft) : null;
  const unavailable = availability !== "available";
  const saveDisabled = unavailable || !draft || !dirty || saving || validationError !== null;
  useDirtyRegistration("trackball-precision", {
    dirty,
    save,
    discard: reload,
  });

  return (
    <section aria-labelledby="trackball-precision-title" className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm space-y-4">
      <div>
        <h3 id="trackball-precision-title" className="text-base font-bold">精密モード</h3>
        <p className="text-sm text-base-content/70">通常時と精密モード時の速さ、使うキーを設定します。</p>
      </div>
      {availability !== "available" ? (
        <PrecisionStatus availability={availability} retry={reload} />
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
          {draft.enabled && <EnabledPrecisionControls confirmed={confirmed} draftPosition={draft.selectedPosition} updateDraft={updateDraft} dirty={dirty} saving={saving} unavailable={unavailable} validationError={validationError} save={save} />}
        </>
      ) : (
        <p role="status" className="text-sm text-base-content/70">設定を読み込んでいます…</p>
      )}
      {(validationError ?? error) && <p role="alert" className="text-sm text-error">{validationError ?? error}</p>}
      {dirty && <p role="status" className="text-xs font-medium text-warning">未保存の変更があります</p>}
      {confirmed && <p className="text-xs text-base-content/50">確認済み: 通常 {confirmed.normalCpi} CPI / 精密 {confirmed.precisionCpi} CPI</p>}
      {availability === "available" && !draft?.enabled && <SaveButton save={save} disabled={saveDisabled} saving={saving} />}
    </section>
  );
}

function PrecisionStatus({ availability, retry }: { availability: ReturnType<typeof useTrackballPrecision>["availability"]; retry: () => Promise<void> }) {
  const message = {
    loading: "設定を読み込んでいます…",
    disconnected: "キーボードに接続すると設定できます",
    "firmware-update-required": "ファームウェアの更新が必要です",
    error: "設定の読み込みに失敗しました",
    available: "",
  }[availability];
  return <>
    <p role="status" className="text-sm text-base-content/70">{message}</p>
    {availability === "error" && <Button onPress={() => void retry()} className="rounded border border-primary px-3 py-1.5 text-sm text-primary">もう一度読み込む</Button>}
  </>;
}

function EnabledPrecisionControls({ confirmed, draftPosition, updateDraft, dirty, saving, unavailable, validationError, save }: {
  confirmed: ReturnType<typeof useTrackballPrecision>["confirmed"];
  draftPosition: number;
  updateDraft: ReturnType<typeof useTrackballPrecision>["updateDraft"];
  dirty: boolean;
  saving: boolean;
  unavailable: boolean;
  validationError: string | null;
  save: ReturnType<typeof useTrackballPrecision>["save"];
}) {
  const selection = useConnectedPrecisionSelection();
  const selectionError = !selection.analysis || !selection.analysis.supported
    ? selection.analysis && !selection.analysis.supported ? selection.analysis.reason : "選んだキーを確認しています"
    : null;
  return <>
    <ConnectedPrecisionKeyPicker selection={selection} confirmed={confirmed} draftPosition={draftPosition} updateDraft={updateDraft} />
    {selectionError && <p role="alert" className="text-sm text-error">{selectionError}</p>}
    <SaveButton save={save} disabled={unavailable || !dirty || saving || validationError !== null || selectionError !== null} saving={saving} />
  </>;
}

function SaveButton({ save, disabled, saving }: { save: () => Promise<void>; disabled: boolean; saving: boolean }) {
  return <div className="flex justify-end">
    <Button onPress={() => void save()} isDisabled={disabled} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-content disabled:cursor-not-allowed disabled:opacity-40">
      {saving ? "保存中…" : "保存"}
    </Button>
  </div>;
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

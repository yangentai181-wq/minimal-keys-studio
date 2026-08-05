interface UnsavedChangesDialogProps {
  open: boolean;
  busy?: boolean;
  onSave(): void;
  onDiscard(): void;
  onCancel(): void;
}

export function UnsavedChangesDialog({ open, busy = false, onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="unsaved-changes-title" className="w-full max-w-sm rounded-xl bg-base-100 p-5 shadow-xl">
        <h2 id="unsaved-changes-title" className="text-base font-bold">変更を保存しますか？</h2>
        <p className="mt-2 text-sm text-base-content/70">移動すると、現在の画面は閉じます。</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded px-3 py-2 text-sm" onClick={onCancel} disabled={busy}>戻る</button>
          <button type="button" className="rounded border border-base-300 px-3 py-2 text-sm" onClick={onDiscard} disabled={busy}>破棄して移動</button>
          <button type="button" className="rounded bg-primary px-3 py-2 text-sm text-primary-content" onClick={onSave} disabled={busy}>保存して移動</button>
        </div>
      </section>
    </div>
  );
}

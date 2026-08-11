const DEFAULT_CLOSE_DURATION_MS = 140;

export function closeDialogWithMotion(
  dialog: HTMLDialogElement,
  durationMs = DEFAULT_CLOSE_DURATION_MS,
): () => void {
  if (!dialog.open) return () => {};

  let finished = false;
  const cleanup = () => {
    dialog.removeEventListener("animationend", finish);
    clearTimeout(timeout);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    dialog.close();
  };

  dialog.setAttribute("data-motion-state", "closing");
  dialog.addEventListener("animationend", finish, { once: true });
  const timeout = setTimeout(finish, durationMs);

  return () => {
    if (finished) return;
    finished = true;
    cleanup();
    dialog.removeAttribute("data-motion-state");
  };
}

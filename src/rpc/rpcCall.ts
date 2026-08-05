export async function safeRpcCall<T>(
  fn: () => Promise<T>,
  toast: (message: string, type: string) => void,
  label: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.error(`${label} failed:`, e);
    toast("操作を完了できませんでした。接続を確認して、もう一度お試しください。", "error");
    return null;
  }
}

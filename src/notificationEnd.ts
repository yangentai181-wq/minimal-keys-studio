export function handleNotificationEnd(
  aborted: boolean,
  onUnexpectedDisconnect: () => void | Promise<void>,
): void {
  if (!aborted) void onUnexpectedDisconnect();
}

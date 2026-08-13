export async function runGuardedKeymapWrite<T>(allowed: boolean, write: () => Promise<T>): Promise<T | undefined> {
  if (!allowed) return undefined;
  return write();
}

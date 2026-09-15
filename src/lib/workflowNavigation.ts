const guards = new Set<() => Promise<boolean>>();
let selectedSiteId = "";
export function rememberWorkflowSite(id: string) { selectedSiteId = id; }
export function lastWorkflowSite() { return selectedSiteId; }

export function registerWorkflowGuard(guard: () => Promise<boolean>) {
  guards.add(guard);
  return () => { guards.delete(guard); };
}

export async function flushWorkflowEdits() {
  for (const guard of guards) if (!await guard()) return false;
  return true;
}

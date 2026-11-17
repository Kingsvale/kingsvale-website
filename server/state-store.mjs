import { mkdir, rename, writeFile, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash, randomBytes } from "node:crypto";

let pending = Promise.resolve();
export function mutateState(work) {
  const result = pending.then(work);
  pending = result.catch(() => {});
  return result;
}
export function revisionOf(value) { return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex"); }
export async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomBytes(8).toString("hex")}.tmp`;
  try { await writeFile(temporary, value, { mode: 0o600 }); await rename(temporary, path); }
  finally { await unlink(temporary).catch(() => {}); }
}

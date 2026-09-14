export type BackupMedia = { filename: string; bytes: number; sha256: string; data: string };
export function collectMedia(directory: string): Promise<BackupMedia[]>;
export function prepareMediaRestore(backup: unknown, directory: string): Promise<() => Promise<void>>;
export function mediaReferences(value: unknown): Set<string>;

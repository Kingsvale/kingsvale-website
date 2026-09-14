// Bound decompression before allocating the complete text, including malicious
// gzip files which expand far beyond their on-disk size.
export async function readBackupFile(file: File, maxBytes = 1_000_000_000): Promise<string> {
  const compressed = /\.gz$/i.test(file.name);
  if (file.size > maxBytes) throw new Error("This backup exceeds the maximum 1 GB import size.");
  if (!compressed) return file.text();
  if (typeof DecompressionStream === "undefined") throw new Error("Your browser cannot open gzip backups. Extract the .json file first or use a current Chrome, Edge or Safari browser.");
  const reader = file.stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error("The expanded backup exceeds the maximum import size."); }
      chunks.push(new Uint8Array(chunk.value));
    }
    return new Blob(chunks).text();
  } finally { reader.releaseLock(); }
}

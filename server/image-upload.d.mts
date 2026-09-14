import type { ImageAsset } from "../src/lib/contentTypes";
export function storeImage(upload: { filename: string; contentType: string; data: Buffer } | null, directory: string): Promise<ImageAsset>;

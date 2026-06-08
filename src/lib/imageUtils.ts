const UNSPLASH_HOST = "images.unsplash.com";

export const responsiveWidths = [480, 720, 960, 1280, 1600, 2000] as const;

export function getOptimizedImageUrl(src: string, width?: number): string {
  if (!width || !isOptimizableUnsplashImage(src)) {
    return src;
  }

  try {
    const url = new URL(src);

    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "crop");
    url.searchParams.set("q", "74");
    url.searchParams.set("w", String(width));
    return url.toString();
  } catch {
    return src;
  }
}

export function getResponsiveSrcSet(src: string, widths = responsiveWidths): string | undefined {
  if (!isOptimizableUnsplashImage(src)) {
    return undefined;
  }

  return widths
    .map((width) => `${getOptimizedImageUrl(src, width)} ${width}w`)
    .join(", ");
}

function isOptimizableUnsplashImage(src: string) {
  if (src.startsWith("data:") || src.startsWith("blob:")) {
    return false;
  }

  try {
    return new URL(src).hostname === UNSPLASH_HOST;
  } catch {
    return false;
  }
}

export async function readImageFile(file: File): Promise<string> {
  const maxBytes = 2.5 * 1024 * 1024;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP or AVIF image.");
  }

  if (file.size > maxBytes) {
    throw new Error("Images must be 2.5 MB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 8192;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return `data:${file.type};base64,${btoa(binary)}`;
}

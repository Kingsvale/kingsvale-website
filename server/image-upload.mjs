import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export async function storeImage(upload, directory) {
  if (!upload || !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(upload.contentType)) {
    throw new Error("Choose a JPEG, PNG, WebP or AVIF image.");
  }
  if (!upload.data.length || upload.data.length > 12_000_000) throw new Error("Images must be 12 MB or smaller.");
  const metadata = await sharp(upload.data, { limitInputPixels: 32_000_000 }).metadata();
  if (!metadata.width || !metadata.height || !["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format)) {
    throw new Error("This image could not be read. Try exporting it as JPEG or PNG.");
  }
  const rotatedWidth = metadata.orientation >= 5 ? metadata.height : metadata.width;
  const maxWidth = Math.min(rotatedWidth, 2400);
  const widths = [...new Set([480, 960, 1440, 1920, maxWidth].filter((width) => width <= maxWidth))];
  const slug = upload.filename.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80) || "image";
  const id = randomBytes(12).toString("hex");
  await mkdir(directory, { recursive: true });
  const variants = [];
  let largest;
  for (const width of widths.sort((a, b) => a - b)) {
    const filename = `${slug}-${id}-${width}.webp`;
    const info = await sharp(upload.data, { limitInputPixels: 32_000_000 }).rotate()
      .resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toFile(join(directory, filename));
    variants.push({ width: info.width, src: `/media/${filename}` });
    largest = info;
  }
  return {
    src: variants.at(-1).src,
    alt: upload.filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 150),
    focalPoint: "50% 50%", width: largest.width, height: largest.height,
    filename: upload.filename.slice(0, 200), variants
  };
}

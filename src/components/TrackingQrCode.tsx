import { useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { boundedPercent } from "../lib/qrStyle";
import type { TrackingQrStyle } from "../lib/trackingTypes";

const WORD_QR_EXPORT_SIZE = 1155;

type TrackingQrCodeProps = {
  value: string;
  style: TrackingQrStyle;
  title: string;
};

export function TrackingQrCode({ value, style, title }: TrackingQrCodeProps) {
  const [downloadState, setDownloadState] = useState<"idle" | "busy" | "error">("idle");
  const previewSvg = buildStyledQrSvg(value, style, title);

  async function downloadPng() {
    if (downloadState === "busy") {
      return;
    }

    setDownloadState("busy");
    try {
      const documentSvg = buildStyledQrSvg(value, style, title, { includeCaption: false });
      const blob = await svgToPngBlob(
        documentSvg,
        WORD_QR_EXPORT_SIZE,
        WORD_QR_EXPORT_SIZE,
        safeColor(style.background, "#fbf8f2")
      );
      downloadBlob(blob, `${toFileName(title)}-qr.png`);
      setDownloadState("idle");
    } catch (error) {
      console.error("QR PNG export failed", error);
      setDownloadState("error");
    }
  }

  return (
    <div className="qr-designer__preview">
      <div
        className="qr-designer__svg"
        aria-label="QR code preview"
        dangerouslySetInnerHTML={{ __html: previewSvg }}
      />
      <button
        type="button"
        className="admin-ghost"
        onClick={downloadPng}
        disabled={downloadState === "busy"}
      >
        <Download aria-hidden="true" />
        {downloadState === "busy" ? "Preparing PNG..." : "Download PNG"}
      </button>
      <small className="qr-designer__download-note">Exports a square 1155px PNG for Word letters.</small>
      {downloadState === "error" ? (
        <small className="qr-designer__download-error" role="alert">
          PNG export failed. Please try again.
        </small>
      ) : null}
    </div>
  );
}

type QrSvgOptions = {
  includeCaption?: boolean;
};

function buildStyledQrSvg(value: string, style: TrackingQrStyle, title: string, options: QrSvgOptions = {}) {
  const qr = QRCode.create(value || "https://www.kingsvalehomes.co.uk", {
    errorCorrectionLevel: "H"
  });
  const includeCaption = options.includeCaption ?? true;
  const moduleCount = qr.modules.size;
  const quiet = 3;
  const moduleSize = 10;
  const labelHeight = includeCaption ? 42 : 0;
  const size = (moduleCount + quiet * 2) * moduleSize;
  const totalHeight = size + labelHeight;
  const foreground = safeColor(style.foreground, "#22211d");
  const background = safeColor(style.background, "#fbf8f2");
  const accent = safeColor(style.accent, "#ad9576");
  const dotRoundness = boundedPercent(style.dotRoundness, 48);
  const finderRoundness = boundedPercent(style.finderRoundness, 24);
  const frameRoundness = boundedPercent(style.frameRoundness, 42);
  const frameCut = boundedPercent(style.frameCut, 0);
  const dotRadius = (moduleSize / 2) * (dotRoundness / 100);
  const finderOrigins = [
    [quiet, quiet],
    [quiet + moduleCount - 7, quiet],
    [quiet, quiet + moduleCount - 7]
  ];
  const modules: string[] = [];

  for (let y = 0; y < moduleCount; y += 1) {
    for (let x = 0; x < moduleCount; x += 1) {
      if (!qr.modules.get(x, y) || isFinderModule(x, y, moduleCount)) {
        continue;
      }

      modules.push(moduleShape(x + quiet, y + quiet, moduleSize, dotRadius, foreground));
    }
  }

  const finders = finderOrigins.map(([x, y]) =>
    finderShape(x, y, moduleSize, finderRoundness, foreground, background, accent)
  );
  const label = escapeText(style.frameLabel || "Scan for project updates");
  const brand = escapeText(title.slice(0, 28));
  const caption = includeCaption
    ? `<text x="${size / 2}" y="${size + 22}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="800" fill="${foreground}">${label}</text>
  <text x="${size / 2}" y="${size + 37}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${accent}">${brand}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${totalHeight}" role="img" aria-label="${escapeAttribute(label)}" data-qr-svg="true">
  ${frameShape(0, 0, size, totalHeight, frameRoundness, frameCut, background)}
  ${frameShape(8, 8, size - 16, size - 16, frameRoundness, frameCut, background, accent, 2)}
  ${modules.join("\n  ")}
  ${finders.join("\n  ")}
  ${style.includeLogo ? logoMark(size, moduleSize, background, foreground, accent) : ""}
  ${caption}
</svg>`;
}

function svgToPngBlob(svg: string, width: number, height: number, background: string) {
  return new Promise<Blob>((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(svgUrl);
          reject(new Error("Canvas is not available for QR PNG export."));
          return;
        }

        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(svgUrl);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Browser could not create a PNG QR code."));
            return;
          }
          resolve(blob);
        }, "image/png");
      } catch (error) {
        URL.revokeObjectURL(svgUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("Browser could not render the QR code before PNG export."));
    };

    image.src = svgUrl;
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function moduleShape(x: number, y: number, size: number, radius: number, color: string) {
  const left = x * size;
  const top = y * size;

  if (radius >= size / 2) {
    return `<circle cx="${left + size / 2}" cy="${top + size / 2}" r="${size * 0.42}" fill="${color}"/>`;
  }

  return `<rect x="${left + 1}" y="${top + 1}" width="${size - 2}" height="${size - 2}" rx="${radius}" fill="${color}"/>`;
}

function finderShape(
  x: number,
  y: number,
  size: number,
  roundness: number,
  foreground: string,
  background: string,
  accent: string
) {
  const left = x * size;
  const top = y * size;
  const radius = size * 3.5 * (roundness / 100);
  const innerRadius = size * 2.5 * (roundness / 100);
  const coreRadius = size * 1.5 * (roundness / 100);
  return `<rect x="${left}" y="${top}" width="${size * 7}" height="${size * 7}" rx="${radius}" fill="${foreground}"/>
  <rect x="${left + size}" y="${top + size}" width="${size * 5}" height="${size * 5}" rx="${innerRadius}" fill="${background}"/>
  <rect x="${left + size * 2}" y="${top + size * 2}" width="${size * 3}" height="${size * 3}" rx="${coreRadius}" fill="${accent}"/>`;
}

function frameShape(
  x: number,
  y: number,
  width: number,
  height: number,
  roundness: number,
  cutPercent: number,
  fill: string,
  stroke?: string,
  strokeWidth = 0
) {
  const strokeAttributes = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : "";
  if (cutPercent > 0) {
    const cut = Math.min(34, width * 0.16, height * 0.16) * (cutPercent / 100);
    const path = [
      `M ${x + cut} ${y}`,
      `H ${x + width - cut}`,
      `L ${x + width} ${y + cut}`,
      `V ${y + height - cut}`,
      `L ${x + width - cut} ${y + height}`,
      `H ${x + cut}`,
      `L ${x} ${y + height - cut}`,
      `V ${y + cut}`,
      "Z"
    ].join(" ");
    return `<path d="${path}" fill="${fill}"${strokeAttributes}/>`;
  }

  const radius = Math.min(width, height) * 0.08 * (roundness / 100);
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"${strokeAttributes}/>`;
}

function logoMark(size: number, moduleSize: number, background: string, foreground: string, accent: string) {
  const box = moduleSize * 6;
  const left = (size - box) / 2;
  const top = (size - box) / 2;
  return `<rect x="${left}" y="${top}" width="${box}" height="${box}" rx="10" fill="${background}" stroke="${accent}" stroke-width="2"/>
  <text x="${size / 2}" y="${top + box / 2 + 9}" text-anchor="middle" font-family="Georgia, serif" font-size="28" font-weight="700" fill="${foreground}">K</text>`;
}

function isFinderModule(x: number, y: number, moduleCount: number) {
  return (
    (x < 7 && y < 7) ||
    (x >= moduleCount - 7 && y < 7) ||
    (x < 7 && y >= moduleCount - 7)
  );
}

function safeColor(value: string, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function escapeText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function toFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tracking-page";
}

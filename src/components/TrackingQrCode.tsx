import { useState } from "react";
import { Download } from "lucide-react";
import { buildStyledQrSvg, safeColor, WORD_QR_EXPORT_SIZE } from "../lib/trackingQrSvg.js";
import type { TrackingQrStyle } from "../lib/trackingTypes";

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

function toFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tracking-page";
}

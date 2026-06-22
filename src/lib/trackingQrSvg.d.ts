import type { TrackingQrStyle } from "./trackingTypes";

export const WORD_QR_EXPORT_SIZE: number;

export type QrSvgOptions = {
  includeCaption?: boolean;
};

export function buildStyledQrSvg(
  value: string,
  style: TrackingQrStyle,
  title: string,
  options?: QrSvgOptions
): string;

export function safeColor(value: string | undefined, fallback: string): string;

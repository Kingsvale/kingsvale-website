export function boundedPercent(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, value));
}

export function presetRoundness(value?: string) {
  if (value === "square") {
    return 0;
  }
  if (value === "circle") {
    return 100;
  }
  return 48;
}

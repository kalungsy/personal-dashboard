export function fmt(n: number | null | undefined): string {
  return n != null ? `$${Number(n).toFixed(2)}` : "N/A";
}

export function fmtVol(n: number | null | undefined): string {
  return n != null ? `${(n / 1e6).toFixed(1)}M` : "N/A";
}

export function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
}

export function sliceStartByRange(labelsLength: number, rangeLabel: string): number {
  const ranges = [
    { label: "3D", days: 3 },
    { label: "1W", days: 5 },
    { label: "1M", days: 21 },
    { label: "3M", days: 999 },
  ];
  const r = ranges.find((x) => x.label === rangeLabel) ?? ranges[ranges.length - 1];
  const n = Math.min(r.days, labelsLength);
  return labelsLength - n;
}

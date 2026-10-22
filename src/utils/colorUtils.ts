/**
 * Converte cor hexadecimal (#RRGGBB ou #RGB) e opacidade percentual (0-100) para string rgba(...).
 */
export function hexToRgba(hex: string, opacityPercent: number): string {
  if (!hex) {
    const fallbackAlpha = Math.max(0, Math.min(1, opacityPercent / 100));
    return `rgba(255, 255, 255, ${fallbackAlpha})`;
  }
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (cleanHex.length !== 6) {
    const fallbackAlpha = Math.max(0, Math.min(1, opacityPercent / 100));
    return `rgba(255, 255, 255, ${fallbackAlpha})`;
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const safeR = isNaN(r) ? 255 : r;
  const safeG = isNaN(g) ? 255 : g;
  const safeB = isNaN(b) ? 255 : b;
  const a = Math.max(0, Math.min(100, opacityPercent)) / 100;
  return `rgba(${safeR}, ${safeG}, ${safeB}, ${a})`;
}

// Mix ratios used for the 3-stop gradient.
const GRADIENT_STOPS = [0.08, 0.14, 0.20];

// Parse a CSS color into its RGB components [r, g, b].
// Returns null when called outside a browser (SSR/tests) so callers can fall back.
function getRgbFromColor(color) {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);

  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

// Memoize RGB lookups
const rgbCache = new Map();

function getRgbCached(color) {
  if (rgbCache.has(color)) return rgbCache.get(color);

  const rgb = getRgbFromColor(color);
  if (rgb) rgbCache.set(color, rgb);

  return rgb;
}

export function isColorLight(color) {
  const rgb = getRgbCached(color);
  if (!rgb) return false;

  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928
      ? v / 12.92
      : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  const luminance =
    0.2126 * r +
    0.7152 * g +
    0.0722 * b;

  // Lower threshold
  return luminance > 0.35;
}

// Mix a base color toward a target color by ratio (0 = base, 1 = target).
function mixColor(baseRgb, targetRgb, ratio) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return baseRgb.map((c, i) => clamp(c + (targetRgb[i] - c) * ratio));
}

export function getGradientBackground(color, mode = "light") {
  const rgb = getRgbCached(color);
  if (!rgb) return color;

  const baseColorIsLight = isColorLight(color);

  // ================= Dark Theme =================
  if (mode === "dark") {
    const target = baseColorIsLight ? [40, 40, 40] : [18, 18, 18];

    const stops = GRADIENT_STOPS.map((ratio) => {
      const [r, g, b] = mixColor(rgb, target, ratio);
      return `rgb(${r}, ${g}, ${b})`;
    });

    return `linear-gradient(150deg, ${stops[0]} 0%, ${stops[1]} 50%, ${stops[2]} 100%)`;
  }

  // ================= Light Theme =================
  const stops = GRADIENT_STOPS.map((ratio) => {
    // INCREASED STRENGTH: Changed base from 0.07 -> 0.14 and scale from 0.09 -> 0.16
    // This allows more of your vibrant primary color to pull through, making it darker.
    const colorStrength = 0.14 + ratio * 0.16;

    const r = Math.round(255 - (255 - rgb[0]) * colorStrength);
    const g = Math.round(255 - (255 - rgb[1]) * colorStrength);
    const b = Math.round(255 - (255 - rgb[2]) * colorStrength);

    return `rgb(${r}, ${g}, ${b})`;
  });

  return `linear-gradient(
    150deg,
    ${stops[0]} 0%,
    ${stops[1] ? stops[1] : stops[0]} 50%,
    ${stops[stops.length - 1]} 100%
  )`;
}

// Returns the color as an `rgba(...)` string at the given opacity.
// Useful for soft tints / badges that follow the theme without hardcoding.
export function withAlpha(color, alpha) {
  if (color === null || color === undefined) return color;
  const rgb = getRgbCached(color);
  if (!rgb) return color;
  const [r, g, b] = rgb;
  const a = Math.max(0, Math.min(1, Number(alpha) || 0));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
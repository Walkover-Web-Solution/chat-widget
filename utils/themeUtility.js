// Mix ratios used for the 3-stop gradient. Adjust here to tweak the look.
const GRADIENT_STOPS = [0.08, 0.14, 0.20];

// Parse a CSS color into its RGB components [r, g, b].
// Returns null when called outside a browser (SSR/tests) so callers can fall back.
function getRgbFromColor(color) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

// Memoize RGB lookups so repeated calls with the same color skip the canvas work.
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
  const [r, g, b] = rgb;

  // Calculate brightness (luminance)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // Return true if the color is light, otherwise false
  return brightness > 128;
}

export function getGradientBackground(color) {
  const rgb = getRgbCached(color);
  if (!rgb) return color;
  const [r, g, b] = rgb;

  // Mix white with the base color at each stop for a smooth 3-stop gradient.
  const mix = (c, ratio) => Math.round(255 + (c - 255) * ratio);
  const stops = GRADIENT_STOPS.map((ratio) => {
    const [sr, sg, sb] = [mix(r, ratio), mix(g, ratio), mix(b, ratio)];
    return `rgb(${sr}, ${sg}, ${sb})`;
  });

  return `linear-gradient(150deg, ${stops[0]} 0%, ${stops[1]} 50%, ${stops[2]} 100%)`;
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
export function isColorLight(color) {
  // Create an offscreen canvas for measuring the color brightness
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);

  // Get the color data (RGBA) of the filled rectangle
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;

  // Calculate brightness (luminance)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // Return true if the color is light, otherwise false
  return brightness > 128;
}

export function getPrimaryGradientBg(primaryColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

  // Mix white with primary at 8%, 14% and 20% for a smooth 3-stop gradient
  const light = (c, mix) => Math.round(255 + (c - 255) * mix);
  const r1 = light(r, 0.08), g1 = light(g, 0.08), b1 = light(b, 0.08);
  const r2 = light(r, 0.14), g2 = light(g, 0.14), b2 = light(b, 0.14);
  const r3 = light(r, 0.20), g3 = light(g, 0.20), b3 = light(b, 0.20);

  return `linear-gradient(150deg, rgb(${r1}, ${g1}, ${b1}) 0%, rgb(${r2}, ${g2}, ${b2}) 50%, rgb(${r3}, ${g3}, ${b3}) 100%)`;
}

// Returns the primary color as an `rgba(...)` string at the given opacity.
// Useful for soft tints / badges that follow the theme without hardcoding.
export function withAlpha(color, alpha) {
  if (color === null || color === undefined) return color;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let r = 0, g = 0, b = 0;
  if (canvas) {
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    r = data[0]; g = data[1]; b = data[2];
  } else {
    // Fallback for non-browser environments
    return color;
  }
  const a = Math.max(0, Math.min(1, Number(alpha) || 0));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// PHOTO NOVA - pixel filter engine (works in every browser, no ctx.filter needed)
const NovaFilters = (() => {
  const PRESETS = {
    Original: {},
    Vivid:   { contrast: 15, saturation: 35 },
    Noir:    { gray: 1, contrast: 25, vignette: 40 },
    Vintage: { sepia: 50, contrast: -10, warmth: 20, vignette: 30 },
    Cool:    { warmth: -35, saturation: 10 },
    Warm:    { warmth: 35, brightness: 5 },
    Fade:    { contrast: -25, brightness: 10, saturation: -20 },
    Dream:   { brightness: 12, saturation: 25, hue: -10, contrast: -10 }
  };

  function apply(imageData, p) {
    const d = imageData.data, w = imageData.width, h = imageData.height;
    const br = p.brightness * 2.55;
    const c = p.contrast * 2.55, cf = (259 * (c + 255)) / (255 * (259 - c));
    const sat = 1 + p.saturation / 100, wm = p.warmth * 0.5;
    const se = p.sepia / 100, vg = p.vignette / 100;
    const a = p.hue * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const m = [
      .213 + cs * .787 - sn * .213, .715 - cs * .715 - sn * .715, .072 - cs * .072 + sn * .928,
      .213 - cs * .213 + sn * .143, .715 + cs * .285 + sn * .140, .072 - cs * .072 - sn * .283,
      .213 - cs * .213 - sn * .787, .715 - cs * .715 + sn * .715, .072 + cs * .928 + sn * .072
    ];
    const cx = w / 2, cy = h / 2, maxD = Math.hypot(cx, cy);

    for (let i = 0, px = 0; i < d.length; i += 4, px++) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (p.hue) {
        const R = r * m[0] + g * m[1] + b * m[2];
        const G = r * m[3] + g * m[4] + b * m[5];
        const B = r * m[6] + g * m[7] + b * m[8];
        r = R; g = G; b = B;
      }
      r += br + wm; g += br; b += br - wm;
      r = (r - 128) * cf + 128; g = (g - 128) * cf + 128; b = (b - 128) * cf + 128;
      let l = .299 * r + .587 * g + .114 * b;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      if (se) {
        const sr = .393 * r + .769 * g + .189 * b;
        const sg = .349 * r + .686 * g + .168 * b;
        const sb = .272 * r + .534 * g + .131 * b;
        r += (sr - r) * se; g += (sg - g) * se; b += (sb - b) * se;
      }
      if (p.gray) { l = .299 * r + .587 * g + .114 * b; r = g = b = l; }
      if (vg) {
        const x = px % w - cx, y = ((px / w) | 0) - cy;
        const f = 1 - vg * Math.pow(Math.hypot(x, y) / maxD, 2) * 1.2;
        r *= f; g *= f; b *= f;
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; // Uint8ClampedArray clamps automatically
    }
  }
  return { apply, PRESETS };
})();

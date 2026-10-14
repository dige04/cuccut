// Drawing source (vector) of the CucCut app icon: three horizontal tracks form a rounded play button, cut by a playhead with a star sparkle,
// and each track has two segments of different shades on either side of the cut. The geometry is ported unchanged from v2; the colours are redone:
// a solid brand-colour tile + white shapes + one light segment tint, three colours in total (Spectrum 2's “one product colour, in two shades”).
// 1024 design units, macOS icon template (824 body, continuous corners, shadow). The tile colour does not change with the system light/dark mode.
// Usage: import { svg, VARIANTS } from './app-icon.mjs'; svg(VARIANTS.coral)
// Design rationale: see docs/design/brand/app-icon.md.

const rad = (deg) => (deg * Math.PI) / 180;
const f = (n) => +n.toFixed(4);

// Template: body 824×824 placed at (100,100), Figma-style continuous corners (radius 185.4, smoothing 0.6), shadow black 30% / blur 20 / offset down 12.
export const BODY = { x: 100, y: 100, w: 824, h: 824, r: 185.4, smooth: 0.6 };

export const CORAL = '#FF5C4A'; // Brand colour: CucCut's coral
export const CORAL_DEEP = '#E8381F'; // Deep brand-colour shade, used only in the gradient variant
export const CORAL_TINT = '#FFC1B8'; // Light brand-colour shade: the “already played” segment to the left of the playhead, echoing the played subtitles in the app turning grey
export const INK = '#1F1F1F'; // Deep tile (alternative)
export const WHITE = '#FFFFFF';

// Geometry. Triangle left edge 332, playhead at 42%: the luminance centroid of the shapes falls right on the tile's centre line (see docs/design/brand/app-icon.md §4),
// the left segment is wide enough to read as a segment, and it avoids the narrowing tips of the upper and lower tracks.
export const GEOMETRY = {
  L: 332, // Triangle left edge
  W: 468, // Triangle width (left edge to tip)
  H: 520, // Triangle height
  yc: 576, // Horizontal line where the tip sits
  gap: 22, // Gap between tracks
  rCorner: 48, // Upper-left and lower-left corner radius
  rApex: 42, // Tip corner radius
  playhead: 0.42, // Playhead position as a share of the triangle width; also the cut on each track between its left and right segments
  casing: 44, // Total gap on both sides of the playhead (showing the tile), also the gap between segments
  line: 20, // Playhead line width
  sparkR: 104, // Star radius
  sparkDy: -44, // Star centre relative to the triangle's top edge
};

// Colour variants. tile is the base tile (solid or [top, bottom] gradient); left / right are the segment colours on each side of each track's cut (left is the played one, light; right is the not-yet-played one, solid); mark is the playhead and star.
export const VARIANTS = {
  // Final: coral tile, left played segments light coral, right segments white; AI elements (playhead + star) white.
  coral: { id: 'coral', name: 'Coral tile', tile: CORAL, left: CORAL_TINT, right: WHITE, mark: WHITE },
  // Alternative: deep grey tile, left played segments white, right coral; AI elements white.
  ink: { id: 'ink', name: 'Dark tile', tile: INK, left: WHITE, right: CORAL, mark: WHITE },
  // Alternative: single-hue gradient tile (Spectrum 2 brand gradient), otherwise same as the recommended one.
  gradient: { id: 'gradient', name: 'Gradient tile', tile: [CORAL, CORAL_DEEP], left: CORAL_TINT, right: WHITE, mark: WHITE },
};

export function squircleD(x, y, w, h, R, s) {
  const p = Math.min((1 + s) * R, Math.min(w, h) / 2);
  const arcMeasure = 90 * (1 - s);
  const L = Math.sin(rad(arcMeasure / 2)) * R * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p34 = R * Math.tan(rad(alpha / 2));
  const beta = 45 * s;
  const c = p34 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - L - c - d) / 3;
  const a = 2 * b;
  return [
    `M ${f(x + w - p)} ${f(y)}`,
    `c ${f(a)} 0 ${f(a + b)} 0 ${f(a + b + c)} ${f(d)}`,
    `a ${f(R)} ${f(R)} 0 0 1 ${f(L)} ${f(L)}`,
    `c ${f(d)} ${f(c)} ${f(d)} ${f(b + c)} ${f(d)} ${f(a + b + c)}`,
    `L ${f(x + w)} ${f(y + h - p)}`,
    `c 0 ${f(a)} 0 ${f(a + b)} ${f(-d)} ${f(a + b + c)}`,
    `a ${f(R)} ${f(R)} 0 0 1 ${f(-L)} ${f(L)}`,
    `c ${f(-c)} ${f(d)} ${f(-(b + c))} ${f(d)} ${f(-(a + b + c))} ${f(d)}`,
    `L ${f(x + p)} ${f(y + h)}`,
    `c ${f(-a)} 0 ${f(-(a + b))} 0 ${f(-(a + b + c))} ${f(-d)}`,
    `a ${f(R)} ${f(R)} 0 0 1 ${f(-L)} ${f(-L)}`,
    `c ${f(-d)} ${f(-c)} ${f(-d)} ${f(-(b + c))} ${f(-d)} ${f(-(a + b + c))}`,
    `L ${f(x)} ${f(y + p)}`,
    `c 0 ${f(-a)} 0 ${f(-(a + b))} ${f(d)} ${f(-(a + b + c))}`,
    `a ${f(R)} ${f(R)} 0 0 1 ${f(L)} ${f(-L)}`,
    `c ${f(c)} ${f(-d)} ${f(b + c)} ${f(-d)} ${f(a + b + c)} ${f(-d)}`,
    'Z',
  ].join(' ');
}

// Polygon, each vertex with its own rounded corner; if the tangent lengths of adjacent rounded corners add up to more than the edge length, they are scaled down proportionally.
export function roundPolyD(pts, radii) {
  const n = pts.length;
  const geo = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const ax = a[0] - p[0],
      ay = a[1] - p[1],
      bx = b[0] - p[0],
      by = b[1] - p[1];
    const la = Math.hypot(ax, ay),
      lb = Math.hypot(bx, by);
    const th = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
    return { ax: ax / la, ay: ay / la, bx: bx / lb, by: by / lb, lb, tan: Math.tan(th / 2) };
  });
  const t = geo.map((g, i) => radii[i] / g.tan);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const len = geo[i].lb;
    if (t[i] + t[j] > len) {
      const s = len / (t[i] + t[j]);
      t[i] *= s;
      t[j] *= s;
    }
  }
  const d = pts.map(([x, y], i) => {
    const g = geo[i];
    const sx = x + g.ax * t[i],
      sy = y + g.ay * t[i];
    const ex = x + g.bx * t[i],
      ey = y + g.by * t[i];
    const sweep = (x - sx) * (ey - y) - (y - sy) * (ex - x) > 0 ? 1 : 0;
    const r = f(t[i] * g.tan);
    return `${i === 0 ? 'M' : 'L'} ${f(sx)} ${f(sy)} A ${r} ${r} 0 0 ${sweep} ${f(ex)} ${f(ey)}`;
  });
  return `${d.join(' ')} Z`;
}

// Same four-point star as the app's ai-sparkle icon (control point ≈ 0.17r).
export function sparkleD(cx, cy, r, k = 0.17) {
  const q = r * k;
  return [
    `M ${f(cx)} ${f(cy - r)}`,
    `Q ${f(cx + q)} ${f(cy - q)} ${f(cx + r)} ${f(cy)}`,
    `Q ${f(cx + q)} ${f(cy + q)} ${f(cx)} ${f(cy + r)}`,
    `Q ${f(cx - q)} ${f(cy + q)} ${f(cx - r)} ${f(cy)}`,
    `Q ${f(cx - q)} ${f(cy - q)} ${f(cx)} ${f(cy - r)}`,
    'Z',
  ].join(' ');
}

// SVG on a 1024 canvas. With shadow=false the macOS template shadow is not drawn (for favicon, ICO, etc. that carry their own container).
export function svg(variant = VARIANTS.coral, { shadow = true, geometry = {} } = {}) {
  const o = { ...GEOMETRY, ...geometry };
  const y0 = o.yc - o.H / 2;
  const y1 = o.yc + o.H / 2;
  const n = 3;
  const h = (o.H - (n - 1) * o.gap) / n;
  const px = o.L + o.W * o.playhead;
  const sy = y0 + o.sparkDy;
  const body = squircleD(BODY.x, BODY.y, BODY.w, BODY.h, BODY.r, BODY.smooth);
  const tri = roundPolyD(
    [
      [o.L, y0],
      [o.L + o.W, o.yc],
      [o.L, y1],
    ],
    [o.rCorner, o.rApex, o.rCorner],
  );
  const gradient = Array.isArray(variant.tile);
  const tileFill = gradient ? 'url(#tile)' : variant.tile;
  const casingColor = gradient ? 'url(#tile)' : variant.tile;
  const rows = Array.from({ length: n }, (_, i) => {
    const top = f(y0 + i * (h + o.gap));
    return [
      `<rect x="${o.L - 20}" y="${top}" width="${f(px - (o.L - 20))}" height="${f(h)}" fill="${variant.left}"/>`,
      `<rect x="${f(px)}" y="${top}" width="${f(o.L + o.W + 20 - px)}" height="${f(h)}" fill="${variant.right}"/>`,
    ].join('');
  });
  const playhead = [
    [o.casing, casingColor],
    [o.line, variant.mark],
  ].map(
    ([width, color]) =>
      `<path d="M ${f(px)} ${f(sy + o.sparkR * 0.4)} L ${f(px)} ${f(y1)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`,
  );
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">',
    '<defs>',
    gradient
      ? `<linearGradient id="tile" gradientUnits="userSpaceOnUse" x1="0" y1="${BODY.y}" x2="0" y2="${BODY.y + BODY.h}"><stop offset="0" stop-color="${variant.tile[0]}"/><stop offset="1" stop-color="${variant.tile[1]}"/></linearGradient>`
      : '',
    `<clipPath id="tri"><path d="${tri}"/></clipPath>`,
    shadow
      ? '<filter id="body-shadow" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000000" flood-opacity="0.30"/></filter>'
      : '',
    '</defs>',
    `<path d="${body}" fill="${tileFill}"${shadow ? ' filter="url(#body-shadow)"' : ''}/>`,
    `<g clip-path="url(#tri)">${rows.join('')}</g>`,
    ...playhead,
    `<path d="${sparkleD(px, sy, o.sparkR)}" fill="${variant.mark}"/>`,
    '</svg>',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

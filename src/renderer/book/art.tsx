import type { CSSProperties, ReactNode } from "react";

import type { AmbientId, CardDesign, CornerId, MotifId, PagePattern } from "@/lib/spec/designs";

/**
 * Hand-drawn (flat SVG) illustrations, corner decorations and floating decorations for the
 * invitation templates. Everything is plain markup: nothing to download, and the colours come
 * from the template (CSS variables) so each card keeps its own palette.
 */

const GOLD = "var(--foil)";
// ── Small building blocks ─────────────────────────────────────────────────────

function Lotus({ x, y, s = 1, petal = "#f7b9c6", edge = GOLD }: { x: number; y: number; s?: number; petal?: string; edge?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={edge} strokeWidth="1.2" fill={petal}>
      {[-64, 64, -32, 32, 0].map((r) => (
        <path key={r} d="M0 0C-9-8-9-22 0-32 9-22 9-8 0 0Z" transform={`rotate(${r})`} />
      ))}
    </g>
  );
}

function Flower({ x, y, r = 6, fill, center = "#ffd23f" }: { x: number; y: number; r?: number; fill: string; center?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cy={-r * 0.9} r={r * 0.62} fill={fill} transform={`rotate(${a})`} />
      ))}
      <circle r={r * 0.5} fill={center} />
    </g>
  );
}

function Rose({ x, y, r = 14, fill = "#e5567a", line = "#8e2646" }: { x: number; y: number; r?: number; fill?: string; line?: string }) {
  const k = r / 14;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle r="14" fill={fill} stroke={line} strokeWidth="1" />
      <path d="M-9 -2C-9 -12 8 -13 9 -3C10 6 -3 10 -6 3C-8 -3 2 -7 4 -2C5 1 0 3 -1 0" fill="none" stroke={line} strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

const HEART = "M0 7C-13-3-9-14-3.5-13-1.5-12.8 0-11 0-9 0-11 1.5-12.8 3.5-13 9-14 13-3 0 7Z";
function Heart({ x, y, s = 1, fill = "#e5567a", rot = 0 }: { x: number; y: number; s?: number; fill?: string; rot?: number }) {
  return <path d={HEART} fill={fill} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} />;
}

function Spark({ x, y, s = 1, fill = GOLD }: { x: number; y: number; s?: number; fill?: string }) {
  return <path d="M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2Z" fill={fill} transform={`translate(${x} ${y}) scale(${s})`} />;
}

function Leaf({ x, y, rot = 0, s = 1, fill = "#3f8f5f" }: { x: number; y: number; rot?: number; s?: number; fill?: string }) {
  return <path d="M0 0C7-7 7-19 0-26-7-19-7-7 0 0Z" fill={fill} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} />;
}

function Diya({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-11 0H11C10 8 4 11 0 11S-10 8-11 0Z" fill="#c98a2b" stroke={GOLD} strokeWidth="1" />
      <path d="M0-2C-5-8-1-14 0-19 1-14 5-8 0-2Z" fill="#ff9f1c" />
      <path d="M0-3C-2-6 0-9 0-11 1-9 2-6 0-3Z" fill="#fff3b0" />
    </g>
  );
}

function Cloud({ x, y, s = 1, fill = "#ffffff" }: { x: number; y: number; s?: number; fill?: string }) {
  return <path d="M-22 8A8 8 0 0 1-16-6 12 12 0 0 1 6-10 10 10 0 0 1 22 2 7 7 0 0 1 20 8Z" fill={fill} transform={`translate(${x} ${y}) scale(${s})`} />;
}

function Balloon({ x, y, fill, s = 1, to }: { x: number; y: number; fill: string; s?: number; to?: [number, number] }) {
  return (
    <g>
      <path d={`M${x} ${y + 13 * s}Q${x + 4} ${(y + (to?.[1] ?? y + 40)) / 2 + 8} ${to?.[0] ?? x} ${to?.[1] ?? y + 40}`} stroke="#6b5b73" strokeWidth="1" fill="none" />
      <ellipse cx={x} cy={y} rx={10 * s} ry={12.5 * s} fill={fill} />
      <path d={`M${x} ${y + 12 * s}l-3 5h6Z`} fill={fill} />
      <ellipse cx={x - 3.5 * s} cy={y - 4 * s} rx={2.2 * s} ry={3.6 * s} fill="#fff" opacity=".45" />
    </g>
  );
}

/** Points along a hanging swag (quadratic curve) from (x1,y) to (x2,y) that sags by `sag`. */
function swagPoints(x1: number, x2: number, y: number, sag: number, n: number): [number, number][] {
  const cx = (x1 + x2) / 2;
  const cy = y + sag * 2;
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const u = 1 - t;
    return [u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y + 2 * u * t * cy + t * t * y] as [number, number];
  });
}

function Swag({ x1, x2, y, sag, n, colors, r = 5, line = "#3f8f5f" }: { x1: number; x2: number; y: number; sag: number; n: number; colors: string[]; r?: number; line?: string }) {
  return (
    <g>
      <path d={`M${x1} ${y}Q${(x1 + x2) / 2} ${y + sag * 2} ${x2} ${y}`} fill="none" stroke={line} strokeWidth="2.2" />
      {swagPoints(x1, x2, y, sag, n).map(([px, py], i) => (
        <Flower key={i} x={px} y={py + 2} r={r} fill={colors[i % colors.length]!} />
      ))}
    </g>
  );
}

function Elephant({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  const body = "#e3d2aa";
  const dark = "#c9b88f";
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M8 22Q1 28 3 40" stroke={dark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {[13, 22, 38, 47].map((lx) => (
        <rect key={lx} x={lx} y="38" width="8" height="18" rx="3.5" fill={lx > 30 ? body : dark} />
      ))}
      <rect x="8" y="14" width="50" height="30" rx="14" fill={body} />
      <path d="M17 18H50V34Q33 41 17 34Z" fill="#b3202f" stroke={GOLD} strokeWidth="1.6" />
      {[24, 33, 42].map((cx) => (
        <circle key={cx} cx={cx} cy="27" r="2.2" fill={GOLD} />
      ))}
      <path d="M22 14Q33-6 46 14Z" fill={GOLD} />
      <circle cx="34" cy="-1" r="2.2" fill={GOLD} />
      <circle cx="58" cy="24" r="11" fill={body} />
      <ellipse cx="52" cy="24" rx="6" ry="9.5" fill={dark} />
      <path d="M66 28C73 34 72 44 66 49" stroke={body} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M63 32Q70 35 69 40" stroke="#fffaf0" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M52 8Q58 3 64 12" stroke={GOLD} strokeWidth="2" fill="none" />
      <circle cx="62" cy="21" r="1.4" fill="#3a2414" />
    </g>
  );
}

function Footprint({ x, y, rot }: { x: number; y: number; rot: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} fill="#fff0f3" stroke={GOLD} strokeWidth="1">
      <ellipse cx="0" cy="4" rx="7" ry="10" />
      {[-7, -3.5, 0.5, 4, 7].map((tx, i) => (
        <circle key={tx} cx={tx} cy={-9 - (i === 0 || i === 4 ? -2 : 0.5 * (2 - Math.abs(2 - i)))} r={i === 0 ? 2.4 : 2} />
      ))}
    </g>
  );
}

// ── Illustrations (viewBox 0 0 200 140) ───────────────────────────────────────

function art(id: MotifId, mono: string): ReactNode {
  switch (id) {
    case "lotus":
      return (
        <>
          <Swag x1={8} x2={192} y={14} sag={24} n={9} colors={["#c2415f", "#e8a0b0", "#d4a24c"]} r={5.5} />
          <ellipse cx="70" cy="122" rx="30" ry="7" fill="#6aa981" />
          <ellipse cx="130" cy="122" rx="30" ry="7" fill="#6aa981" />
          <Lotus x={100} y={118} s={1.8} petal="#f4a8b8" />
          <Diya x={26} y={116} s={1.1} />
          <Diya x={174} y={116} s={1.1} />
          <Spark x={52} y={70} s={1.1} />
          <Spark x={148} y={70} s={1.1} />
          <Spark x={100} y={34} s={0.8} />
        </>
      );
    case "elephants":
      return (
        <>
          <Swag x1={14} x2={186} y={12} sag={14} n={8} colors={["#ff9f1c", "#ffd23f", "#e85d04"]} r={5} line="#d4a24c" />
          <Elephant x={6} y={64} />
          <Elephant x={194} y={64} flip />
          <Lotus x={100} y={114} s={1.1} petal="#ffd9a0" />
          <Diya x={100} y={50} s={1.2} />
          <Spark x={100} y={78} s={0.9} />
          <path d="M6 122H194" stroke={GOLD} strokeWidth="1.5" strokeDasharray="1 5" strokeLinecap="round" />
        </>
      );
    case "mandap":
      return (
        <>
          <rect x="30" y="118" width="140" height="8" rx="2" fill={GOLD} />
          <rect x="22" y="126" width="156" height="6" rx="2" fill="#b8862f" />
          {[76, 118].map((px) => (
            <rect key={px} x={px} y="50" width="6" height="68" fill={GOLD} opacity=".55" />
          ))}
          {[44, 150].map((px) => (
            <g key={px}>
              <rect x={px} y="46" width="8" height="72" rx="2" fill={GOLD} />
              <rect x={px - 3} y="110" width="14" height="8" rx="2" fill="#b8862f" />
              <rect x={px - 3} y="42" width="14" height="6" rx="2" fill="#b8862f" />
            </g>
          ))}
          <path d="M36 44H164L154 34H46Z" fill={GOLD} />
          <path d="M58 34C58 12 142 12 142 34Z" fill={GOLD} />
          <path d="M66 32C70 20 130 20 134 32" stroke="#0f4a3f" strokeWidth="1.5" fill="none" />
          <path d="M100 6V14" stroke={GOLD} strokeWidth="2" />
          <circle cx="100" cy="6" r="3.5" fill="#ff9f1c" />
          <Swag x1={52} x2={100} y={48} sag={9} n={5} colors={["#ff9f1c", "#ffbf47"]} r={4} line="#e3c275" />
          <Swag x1={100} x2={148} y={48} sag={9} n={5} colors={["#ff9f1c", "#ffbf47"]} r={4} line="#e3c275" />
          <rect x="82" y="100" width="36" height="18" rx="3" fill="#b3202f" />
          <Diya x={100} y={96} s={1.2} />
          {[88, 112].map((hx) => (
            <g key={hx}>
              <path d={`M${hx} 52V66`} stroke={GOLD} strokeWidth="1.2" />
              <circle cx={hx} cy="69" r="3.5" fill="#ff9f1c" />
            </g>
          ))}
        </>
      );
    case "roses":
      return (
        <>
          {[-70, -35, 35, 70].map((r) => (
            <Leaf key={r} x={100} y={92} rot={r} s={1.5} fill="#2f7d55" />
          ))}
          <Rose x={68} y={86} r={16} fill="#ffc2d1" line="#a4234a" />
          <Rose x={132} y={86} r={16} fill="#ffc2d1" line="#a4234a" />
          <Rose x={100} y={62} r={26} fill="#ffe4e8" line="#a4234a" />
          <Rose x={100} y={104} r={12} fill="#ff8fab" line="#a4234a" />
          <Spark x={58} y={42} s={0.9} />
          <Spark x={144} y={40} s={0.9} />
          <circle cx="82" cy="36" r="2" fill="#fff" />
          <circle cx="120" cy="30" r="2" fill="#fff" />
        </>
      );
    case "balloons":
      return (
        <>
          <Balloon x={48} y={44} fill="#ff6fa5" s={1.35} to={[100, 124]} />
          <Balloon x={152} y={44} fill="#4cc9f0" s={1.35} to={[100, 124]} />
          <Balloon x={80} y={34} fill="#ffc93c" s={1.55} to={[100, 124]} />
          <Balloon x={122} y={36} fill="#7bd88f" s={1.5} to={[100, 124]} />
          <Balloon x={100} y={60} fill="#9b5de5" s={1.5} to={[100, 124]} />
          <path d="M92 124Q100 118 108 124Q100 130 92 124Z" fill="#ff6fa5" />
          <rect x="97" y="122" width="6" height="6" rx="2" fill="#ffc93c" />
          <Spark x={20} y={92} s={1.1} fill="#ffc93c" />
          <Spark x={182} y={96} s={1.1} fill="#ff6fa5" />
          {[[30, 20, "#4cc9f0"], [172, 16, "#ffc93c"], [18, 64, "#ff6fa5"], [186, 70, "#7bd88f"], [70, 112, "#9b5de5"], [134, 112, "#4cc9f0"]].map(([cx, cy, f], i) => (
            <rect key={i} x={cx as number} y={cy as number} width="7" height="3.5" rx="1" fill={f as string} transform={`rotate(${i * 38} ${cx} ${cy})`} />
          ))}
        </>
      );
    case "burst":
      return (
        <>
          {[["#ffd23f", 14, 100], ["#ff6b6b", 186, 96], ["#5eead4", 24, 20], ["#ffd23f", 180, 22]].map(([f, x, y], i) => (
            <path key={i} d={`M${x} ${y}q${i % 2 ? -22 : 22} -18 ${i % 2 ? -10 : 10} -40`} stroke={f as string} strokeWidth="3" fill="none" strokeLinecap="round" />
          ))}
          <path d="M100 14 62 108H138Z" fill="#ff5d8f" />
          <path d="M91 42 70 96Q100 106 130 96L109 42Z" fill="#ffd23f" opacity=".9" />
          <path d="M80 72Q100 80 120 72L124 84Q100 94 76 84Z" fill="#4cc9f0" />
          <ellipse cx="100" cy="108" rx="38" ry="7" fill="#ff5d8f" />
          <circle cx="100" cy="12" r="8" fill="#fff" />
          {[[40, 40, "#ffd23f"], [160, 46, "#5eead4"], [54, 78, "#ff6b6b"], [150, 90, "#ffd23f"], [30, 118, "#4cc9f0"], [170, 120, "#ff6b6b"], [74, 20, "#5eead4"], [128, 28, "#ff6b6b"]].map(([cx, cy, f], i) => (
            <rect key={i} x={cx as number} y={cy as number} width="9" height="4.5" rx="1" fill={f as string} transform={`rotate(${i * 47} ${cx} ${cy})`} />
          ))}
          <Spark x={34} y={64} s={1.2} fill="#fff" />
          <Spark x={168} y={64} s={1.2} fill="#fff" />
          <Spark x={100} y={128} s={0.9} fill="#ffd23f" />
        </>
      );
    case "cake":
      return (
        <>
          <ellipse cx="100" cy="122" rx="62" ry="8" fill="#e8f7fb" />
          <rect x="42" y="88" width="116" height="32" rx="7" fill="#ff8fab" />
          <rect x="56" y="64" width="88" height="26" rx="6" fill="#fff2a8" />
          <rect x="72" y="44" width="56" height="22" rx="6" fill="#ffb3c6" />
          <path d="M42 98q7 8 14 0t14 0 14 0 14 0 14 0 14 0 14 0 14 0v-6H42Z" fill="#fff" />
          <path d="M56 72q8 7 15 0t15 0 15 0 15 0 14 0v-5H56Z" fill="#fff" opacity=".85" />
          {[88, 100, 112].map((cx, i) => (
            <g key={cx}>
              <rect x={cx - 2} y="26" width="4" height="18" rx="1.5" fill={["#4cc9f0", "#ffd23f", "#9b5de5"][i]} />
              <path d={`M${cx} 14C${cx - 5} 20 ${cx - 1} 24 ${cx} 26 ${cx + 1} 24 ${cx + 5} 20 ${cx} 14Z`} fill="#ff9f1c" />
            </g>
          ))}
          {[[64, 108], [88, 112], [116, 109], [140, 112], [100, 80], [78, 55], [124, 56]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2.4" fill={["#fff", "#ffd23f", "#4cc9f0", "#9b5de5"][i % 4]} />
          ))}
          <circle cx="100" cy="43" r="4" fill="#d90429" />
        </>
      );
    case "bouquet":
      return (
        <>
          {[-52, -26, 0, 26, 52].map((r) => (
            <Leaf key={r} x={100} y={104} rot={r} s={2.2} fill="#2f7d55" />
          ))}
          <path d="M70 96L130 96 100 134Z" fill="#fdf4ee" stroke={GOLD} strokeWidth="1.5" />
          <Rose x={100} y={44} r={22} fill="#c9184a" line="#590d22" />
          <Rose x={68} y={64} r={17} fill="#e5383b" line="#590d22" />
          <Rose x={132} y={64} r={17} fill="#e5383b" line="#590d22" />
          <Rose x={84} y={86} r={12} fill="#ff758f" line="#590d22" />
          <Rose x={118} y={86} r={12} fill="#ff758f" line="#590d22" />
          {[[44, 40], [158, 38], [52, 98], [150, 98], [100, 12]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="3" fill="#fff" opacity=".85" />
          ))}
          <path d="M100 96q-20-8-24 4 14 6 24-4zM100 96q20-8 24 4-14 6-24-4z" fill={GOLD} />
        </>
      );
    case "rings":
      return (
        <>
          {[-62, -40, -18, 18, 40, 62].map((r, i) => (
            <Leaf key={r} x={i < 3 ? 52 : 148} y={110} rot={r + (i < 3 ? -20 : 20)} s={1.3} fill="#a7c4a0" />
          ))}
          <circle cx="84" cy="72" r="26" fill="none" stroke="#e0b85c" strokeWidth="7" />
          <circle cx="116" cy="72" r="26" fill="none" stroke="#f6efd9" strokeWidth="7" />
          <path d="M84 46A26 26 0 0 1 100 51.5" stroke="#e0b85c" strokeWidth="7" fill="none" />
          <path d="M100 92.5A26 26 0 0 1 93.5 85" stroke="#f6efd9" strokeWidth="7" fill="none" />
          <path d="M116 46l9-12h-18z" fill="#fff" stroke="#e0b85c" strokeWidth="1.5" />
          <Spark x={116} y={26} s={1.1} fill="#fff" />
          <Spark x={58} y={34} s={0.9} />
          <Spark x={150} y={116} s={0.9} />
        </>
      );
    case "hearts":
      return (
        <>
          <rect width="200" height="140" fill="#ffeef2" />
          <Heart x={100} y={66} s={5.2} fill="#e5567a" />
          <Heart x={72} y={50} s={1.7} fill="#ffb3c6" rot={-14} />
          <Heart x={150} y={34} s={2.2} fill="#ff8fa3" rot={14} />
          <Heart x={44} y={96} s={2.4} fill="#ff8fa3" rot={-10} />
          <Heart x={160} y={104} s={1.8} fill="#e5567a" rot={10} />
          <Heart x={26} y={40} s={1.1} fill="#e5567a" />
          <Heart x={178} y={68} s={1.1} fill="#ffb3c6" />
          <path d="M84 52Q90 44 98 48" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".6" />
          <Spark x={100} y={118} s={1} />
          <Spark x={60} y={20} s={0.8} />
          <Spark x={134} y={122} s={0.8} />
        </>
      );
    case "teddy":
      return (
        <>
          <path d="M122 74Q142 56 148 40" stroke="#8a6a5a" strokeWidth="1.2" fill="none" />
          <path d={HEART} fill="#ff6fa5" transform="translate(150 30) scale(2.3)" />
          <ellipse cx="100" cy="100" rx="25" ry="26" fill="#c98a52" />
          <ellipse cx="100" cy="104" rx="15" ry="16" fill="#f1c9a0" />
          <ellipse cx="78" cy="122" rx="12" ry="8" fill="#c98a52" />
          <ellipse cx="122" cy="122" rx="12" ry="8" fill="#c98a52" />
          <ellipse cx="78" cy="123" rx="6" ry="4" fill="#f1c9a0" />
          <ellipse cx="122" cy="123" rx="6" ry="4" fill="#f1c9a0" />
          <ellipse cx="76" cy="92" rx="8" ry="14" fill="#c98a52" transform="rotate(24 76 92)" />
          <ellipse cx="124" cy="88" rx="8" ry="14" fill="#c98a52" transform="rotate(-38 124 88)" />
          <circle cx="78" cy="42" r="10" fill="#c98a52" />
          <circle cx="122" cy="42" r="10" fill="#c98a52" />
          <circle cx="78" cy="42" r="5" fill="#f1c9a0" />
          <circle cx="122" cy="42" r="5" fill="#f1c9a0" />
          <circle cx="100" cy="60" r="26" fill="#c98a52" />
          <ellipse cx="100" cy="68" rx="12" ry="9" fill="#f1c9a0" />
          <ellipse cx="100" cy="64" rx="4.5" ry="3.2" fill="#4a3322" />
          <circle cx="90" cy="54" r="2.6" fill="#4a3322" />
          <circle cx="110" cy="54" r="2.6" fill="#4a3322" />
          <path d="M94 72Q100 77 106 72" stroke="#4a3322" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M100 86 88 80v12ZM100 86l12-6v12Z" fill="#ff6fa5" />
          <circle cx="100" cy="86" r="3" fill="#ff9ebd" />
          <Spark x={46} y={50} s={0.9} fill="#fff" />
          <Spark x={58} y={110} s={0.7} fill="#fff" />
        </>
      );
    case "clouds":
      return (
        <>
          <rect width="200" height="140" fill="#d3ecfa" />
          <path d="M66 18A34 34 0 1 0 94 80A27 27 0 0 1 66 18Z" fill="#fff6c2" />
          <circle cx="58" cy="52" r="1.8" fill="#8a7a3a" />
          <path d="M52 62Q58 67 64 62" stroke="#8a7a3a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <Cloud x={140} y={46} s={1.7} />
          <Cloud x={62} y={104} s={1.9} />
          <Cloud x={150} y={112} s={1.5} fill="#f3fbff" />
          <Spark x={116} y={20} s={1.2} fill="#ffd23f" />
          <Spark x={170} y={80} s={0.9} fill="#ffd23f" />
          <Spark x={26} y={30} s={0.9} fill="#ffd23f" />
          <Spark x={108} y={86} s={0.8} fill="#fff" />
          <Heart x={100} y={118} s={0.9} fill="#ff8fab" />
        </>
      );
    case "toys":
      return (
        <>
          <g fontFamily="var(--font-ui), sans-serif" fontWeight="800" fontSize="22" textAnchor="middle" fill="#fff">
            <rect x="28" y="82" width="40" height="40" rx="6" fill="#ff7a8a" />
            <text x="48" y="110">A</text>
            <rect x="70" y="82" width="40" height="40" rx="6" fill="#4cc9f0" />
            <text x="90" y="110">B</text>
            <g transform="rotate(-8 69 58)">
              <rect x="48" y="40" width="40" height="40" rx="6" fill="#7bd88f" />
              <text x="68" y="68">C</text>
            </g>
          </g>
          <circle cx="146" cy="50" r="22" fill="#ff7a8a" stroke="#fff" strokeWidth="3" />
          <path d="M136 36Q146 44 156 36M136 64Q146 56 156 64" stroke="#fff" strokeWidth="3" fill="none" />
          <rect x="143" y="72" width="6" height="34" rx="3" fill="#fff" />
          <circle cx="146" cy="112" r="8" fill="#4cc9f0" stroke="#fff" strokeWidth="3" />
          <Spark x={24} y={36} s={1.1} fill="#fff" />
          <Spark x={182} y={96} s={1} fill="#fff" />
          <circle cx="120" cy="108" r="10" fill="#ffffff" stroke="#ff7a8a" strokeWidth="3" />
        </>
      );
    case "cradle":
      return (
        <>
          <path d="M30 128 44 24M170 128 156 24" stroke={GOLD} strokeWidth="5" strokeLinecap="round" />
          <rect x="34" y="18" width="132" height="9" rx="4.5" fill={GOLD} />
          <Swag x1={38} x2={162} y={30} sag={11} n={8} colors={["#ff9f1c", "#e5567a", "#ffd23f"]} r={4.2} />
          <path d="M52 90 58 28M148 90 142 28" stroke={GOLD} strokeWidth="2" />
          <path d="M44 88C56 120 144 120 156 88Z" fill="#7a1f3d" stroke={GOLD} strokeWidth="2.5" />
          <circle cx="100" cy="82" r="12" fill="#f6cba5" />
          <path d="M88 79Q100 66 112 79" fill="#ff9f1c" />
          <circle cx="96" cy="84" r="1.3" fill="#3a2414" />
          <circle cx="104" cy="84" r="1.3" fill="#3a2414" />
          <path d="M97 89Q100 91 103 89" stroke="#3a2414" strokeWidth="1.2" fill="none" />
          <path d="M60 94Q100 74 140 94Q100 112 60 94Z" fill="#fff7e8" stroke={GOLD} strokeWidth="1.2" />
          <Spark x={22} y={60} s={1} />
          <Spark x={180} y={60} s={1} />
          <Diya x={100} y={128} s={0.9} />
        </>
      );
    case "lotusFeet":
      return (
        <>
          <ellipse cx="62" cy="116" rx="30" ry="7" fill="#7cb98f" />
          <ellipse cx="140" cy="116" rx="30" ry="7" fill="#7cb98f" />
          <Lotus x={100} y={112} s={1.9} petal="#f08fb0" />
          <Footprint x={86} y={36} rot={-12} />
          <Footprint x={114} y={36} rot={12} />
          <Spark x={58} y={46} s={0.9} />
          <Spark x={144} y={48} s={0.9} />
          <Spark x={100} y={14} s={0.8} />
        </>
      );
    case "moon":
      return (
        <>
          <rect width="200" height="140" fill="#1d2a66" />
          <circle cx="100" cy="66" r="36" fill="#ffe9a8" />
          <path d="M84 62Q90 57 96 62M106 62Q112 57 118 62" stroke="#8a6a1a" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M92 78Q100 85 108 78" stroke="#8a6a1a" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="82" cy="72" r="5" fill="#ffb4a2" opacity=".6" />
          <circle cx="118" cy="72" r="5" fill="#ffb4a2" opacity=".6" />
          <path d="M122 40Q132 32 140 34 136 44 128 48Z" fill="#fff0b3" opacity=".55" />
          <Cloud x={48} y={112} s={1.6} fill="#c7cff2" />
          <Cloud x={152} y={114} s={1.4} fill="#c7cff2" />
          {[[30, 28, 1.2], [168, 26, 1.4], [150, 70, 0.9], [44, 78, 0.8], [112, 12, 0.8], [178, 100, 0.8]].map(([cx, cy, s], i) => (
            <Spark key={i} x={cx as number} y={cy as number} s={s as number} fill="#ffe9a8" />
          ))}
        </>
      );
    case "kalash":
      return (
        <>
          {[-60, -30, 0, 30, 60].map((r) => (
            <Leaf key={r} x={100} y={52} rot={r} s={1.35} fill={r === 0 ? "#2f7d55" : "#3f8f5f"} />
          ))}
          <path d="M70 62C58 84 64 112 100 116 136 112 142 84 130 62Z" fill="#d4a24c" stroke="#a87a1f" strokeWidth="2" />
          <path d="M66 82Q100 94 134 82M64 98Q100 110 136 98" stroke="#a87a1f" strokeWidth="2" fill="none" />
          <ellipse cx="100" cy="62" rx="31" ry="6" fill="#e6b95a" stroke="#a87a1f" strokeWidth="2" />
          <path d="M78 62Q100 74 122 62 118 74 100 76 82 74 78 62Z" fill="#b3202f" />
          <circle cx="100" cy="30" r="14" fill="#8a5a2a" />
          <path d="M100 14Q96 8 92 10M100 14Q100 6 104 6" stroke="#6b4423" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="95" cy="32" r="1.8" fill="#3a2414" />
          <circle cx="105" cy="32" r="1.8" fill="#3a2414" />
          <circle cx="100" cy="37" r="1.8" fill="#3a2414" />
          <ellipse cx="100" cy="122" rx="26" ry="5" fill="#a87a1f" />
          <Diya x={34} y={116} s={1.2} />
          <Diya x={166} y={116} s={1.2} />
          <Spark x={46} y={52} s={1} />
          <Spark x={154} y={52} s={1} />
        </>
      );
    case "sun":
      return (
        <>
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d="M-4 -34 0 -54 4 -34Z" fill={i % 2 ? "#8a2a0a" : "#c4501a"} transform={`translate(100 70) rotate(${i * 22.5})`} />
          ))}
          <circle cx="100" cy="70" r="32" fill="#c4501a" />
          <circle cx="100" cy="70" r="26" fill="#ffd27a" />
          <circle cx="100" cy="70" r="19" fill="none" stroke="#8a2a0a" strokeWidth="1.5" strokeDasharray="2 3" />
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-12" rx="3.2" ry="6.5" fill="#c4501a" transform={`translate(100 70) rotate(${i * 45})`} />
          ))}
          <circle cx="100" cy="70" r="5" fill="#8a2a0a" />
        </>
      );
    case "marigold":
      return (
        <>
          <Swag x1={4} x2={196} y={10} sag={16} n={10} colors={["#ff9f1c", "#ffb703", "#e85d04"]} r={6.2} line="#2d6a4f" />
          <Swag x1={4} x2={196} y={34} sag={22} n={10} colors={["#ffb703", "#ff9f1c", "#e85d04"]} r={6.2} line="#2d6a4f" />
          {[34, 166].map((sx) => (
            <g key={sx}>
              <path d={`M${sx} 54V116`} stroke="#2d6a4f" strokeWidth="2" />
              {[62, 76, 90, 104].map((sy, i) => (
                <Flower key={sy} x={sx} y={sy} r={6.2} fill={["#ff9f1c", "#ffb703", "#e85d04", "#ffb703"][i]!} />
              ))}
            </g>
          ))}
          <ellipse cx="100" cy="116" rx="28" ry="6" fill="#d9c8a0" opacity=".35" />
          <Diya x={100} y={108} s={1.5} />
          <Flower x={72} y={112} r={6} fill="#ff9f1c" />
          <Flower x={128} y={112} r={6} fill="#ffb703" />
          <Spark x={100} y={72} s={1.2} />
          <Spark x={68} y={76} s={0.8} />
          <Spark x={132} y={76} s={0.8} />
        </>
      );
    case "house":
      return (
        <>
          <path d="M10 124H190" stroke="#f0c36a" strokeWidth="2" strokeLinecap="round" />
          <rect x="56" y="64" width="88" height="60" rx="3" fill="#fff1d6" />
          <path d="M42 68 100 22 158 68Z" fill="#8a2a0a" stroke="#f0c36a" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="132" y="30" width="9" height="20" fill="#8a2a0a" />
          <path d="M90 124V94A10 10 0 0 1 110 94V124Z" fill="#7a3a14" />
          <circle cx="106" cy="108" r="1.6" fill="#f0c36a" />
          {[[64, 78], [122, 78]].map(([wx, wy]) => (
            <g key={wx}>
              <rect x={wx} y={wy} width="14" height="16" rx="2" fill="#ffd27a" stroke="#a85a1e" strokeWidth="2" />
              <path d={`M${(wx as number) + 7} ${wy}v16M${wx} ${(wy as number) + 8}h14`} stroke="#a85a1e" strokeWidth="1.2" />
            </g>
          ))}
          <path d="M84 98Q100 108 116 98" stroke="#2f7d55" strokeWidth="2" fill="none" />
          {[88, 96, 104, 112].map((tx, i) => (
            <Leaf key={tx} x={tx} y={i % 2 ? 103 : 101} rot={180} s={0.5} fill="#3f8f5f" />
          ))}
          <ellipse cx="164" cy="119" rx="9" ry="5" fill="#d4a24c" />
          <path d="M156 118Q164 100 172 118Z" fill="#d4a24c" />
          {[-34, 0, 34].map((r) => (
            <Leaf key={r} x={164} y={104} rot={r} s={0.6} fill="#3f8f5f" />
          ))}
          <Diya x={34} y={118} s={1.1} />
          <path d="M18 124 26 108 34 124M10 124 18 112 26 124" fill="#3f8f5f" opacity=".75" />
          <Spark x={100} y={12} s={0.9} />
          <Spark x={36} y={60} s={0.9} />
          <Spark x={168} y={64} s={0.9} />
        </>
      );
    case "keys":
      return (
        <>
          <rect width="200" height="140" fill="#dff3f2" />
          <rect y="120" width="200" height="20" fill="#bfe3df" />
          <path d="M68 124V50A32 32 0 0 1 132 50V124Z" fill="#e76f51" stroke="#8a3a22" strokeWidth="2.5" />
          <rect x="80" y="62" width="16" height="22" rx="3" fill="none" stroke="#fff3e0" strokeWidth="1.8" />
          <rect x="104" y="62" width="16" height="22" rx="3" fill="none" stroke="#fff3e0" strokeWidth="1.8" />
          <rect x="80" y="92" width="40" height="22" rx="3" fill="none" stroke="#fff3e0" strokeWidth="1.8" />
          <circle cx="100" cy="34" r="13" fill="none" stroke="#2f8f6b" strokeWidth="5" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <circle key={a} cx={100 + 13 * Math.cos((a * Math.PI) / 180)} cy={34 + 13 * Math.sin((a * Math.PI) / 180)} r="2.2" fill="#e5567a" />
          ))}
          <circle cx="122" cy="96" r="2.6" fill="#ffd17a" />
          <rect x="82" y="118" width="36" height="8" rx="2" fill="#8d6e63" />
          <g transform="translate(32 40) rotate(-25)">
            <circle cx="0" cy="0" r="14" fill="none" stroke="#e0a526" strokeWidth="6" />
            <path d="M0 14V62" stroke="#e0a526" strokeWidth="6" strokeLinecap="round" />
            <path d="M0 50h10M0 60h14" stroke="#e0a526" strokeWidth="6" strokeLinecap="round" />
          </g>
          {[26, 166].map((px) => (
            <g key={px}>
              <path d={`M${px - 10} 112h20l-4 18h-12Z`} fill="#c97b50" />
              {[-30, 0, 30].map((r) => (
                <Leaf key={r} x={px} y={112} rot={r} s={1.1} fill="#2f8f6b" />
              ))}
            </g>
          ))}
          <path d="M150 54l4-8 4 8-4 6Z" fill="#ffd17a" />
          <Spark x={168} y={40} s={0.9} fill="#ffd17a" />
        </>
      );
    case "rangoli":
      return (
        <>
          {Array.from({ length: 24 }, (_, i) => (
            <circle key={i} cx="0" cy="-57" r="2.4" fill={i % 2 ? "#ffc43d" : "#fff0d6"} transform={`translate(100 70) rotate(${i * 15})`} />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-42" rx="7.5" ry="13" fill={["#ffc43d", "#ff6b9d", "#4cc9f0"][i % 3]} transform={`translate(100 70) rotate(${i * 30})`} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-24" rx="6" ry="11" fill={i % 2 ? "#fff0d6" : "#9b5de5"} transform={`translate(100 70) rotate(${i * 45 + 22.5})`} />
          ))}
          <circle cx="100" cy="70" r="12" fill="#ffc43d" />
          <circle cx="100" cy="70" r="6" fill="#8b2a6b" />
        </>
      );
    case "monogram":
      return (
        <>
          <circle cx="100" cy="70" r="50" fill="none" stroke={GOLD} strokeWidth="2.5" />
          <circle cx="100" cy="70" r="43" fill="none" stroke={GOLD} strokeWidth="1" strokeDasharray="1.5 4" strokeLinecap="round" />
          {[-60, -36, -12].map((r) => (
            <Leaf key={r} x={52} y={114} rot={r - 18} s={1.1} fill={GOLD} />
          ))}
          {[12, 36, 60].map((r) => (
            <Leaf key={r} x={148} y={114} rot={r + 18} s={1.1} fill={GOLD} />
          ))}
          <text x="100" y="84" textAnchor="middle" fontSize="40" fontWeight="700" fill="var(--cover-text)" fontFamily="var(--font-cormorant), Georgia, serif">
            {mono}
          </text>
          <Spark x={100} y={30} s={0.9} />
          <path d="M70 108H130" stroke={GOLD} strokeWidth="1.5" />
          <Spark x={100} y={108} s={0.7} />
        </>
      );
    case "bunting":
      return (
        <>
          <path d="M6 12Q100 56 194 12" fill="none" stroke="#6b5b73" strokeWidth="1.5" />
          {swagPoints(6, 194, 12, 22, 9).map(([px, py], i) => (
            <path key={i} d={`M${px - 9} ${py - 2}h18l-9 20Z`} fill={["#ff6b9d", "#ffd43b", "#4cc9f0", "#9be0a8", "#9b5de5"][i % 5]} />
          ))}
          <path d="M6 54Q100 90 194 54" fill="none" stroke="#6b5b73" strokeWidth="1.5" />
          {swagPoints(6, 194, 54, 18, 10).map(([px, py], i) => (
            <g key={i}>
              <circle cx={px} cy={py + 6} r="8" fill="#ffd43b" opacity=".3" />
              <circle cx={px} cy={py + 6} r="4" fill={["#ffd43b", "#ff6b9d", "#fff"][i % 3]} />
            </g>
          ))}
          <rect x="74" y="92" width="52" height="38" rx="4" fill="#ff6b9d" />
          <rect x="68" y="84" width="64" height="12" rx="3" fill="#d6336c" />
          <rect x="95" y="84" width="10" height="46" fill="#ffd43b" />
          <path d="M100 84Q86 66 80 78 90 86 100 84ZM100 84Q114 66 120 78 110 86 100 84Z" fill="#ffd43b" />
          {[[30, 100, "#4cc9f0"], [166, 104, "#9be0a8"], [44, 76, "#ffd43b"], [156, 80, "#9b5de5"]].map(([cx, cy, f], i) => (
            <rect key={i} x={cx as number} y={cy as number} width="8" height="4" rx="1" fill={f as string} transform={`rotate(${i * 40 + 10} ${cx} ${cy})`} />
          ))}
          <Spark x={30} y={120} s={1} fill="#ffd43b" />
          <Spark x={172} y={124} s={1} fill="#ff6b9d" />
        </>
      );
    case "wreath":
      return (
        <>
          {Array.from({ length: 22 }, (_, i) => (
            <Leaf key={i} x={100 + 44 * Math.sin((i * 2 * Math.PI) / 22)} y={72 - 44 * Math.cos((i * 2 * Math.PI) / 22)} rot={(i * 360) / 22 + (i % 2 ? 40 : -40)} s={1} fill={i % 3 === 0 ? "#a7c4a0" : i % 3 === 1 ? "#6a9c78" : "#3f6b4e"} />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={i} cx={100 + 44 * Math.sin((i * 2 * Math.PI) / 7 + 0.4)} cy={72 - 44 * Math.cos((i * 2 * Math.PI) / 7 + 0.4)} r="3.4" fill="#e5567a" />
          ))}
          <Spark x={100} y={70} s={1.8} />
          <path d="M70 70H84M116 70H130" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M92 118Q100 128 108 118Q100 124 92 118Z" fill={GOLD} />
        </>
      );
  }
}

/** The template's illustration. `mono` is only used by the monogram design. */
export function Motif({ id, mono = "", className = "w-full h-auto" }: { id: MotifId; mono?: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden="true" role="presentation">
      {art(id, mono)}
    </svg>
  );
}

// ── Page decorations ─────────────────────────────────────────────────────────

function corner(kind: CornerId): ReactNode {
  const stroke = { stroke: "var(--accent-text)", fill: "none", strokeWidth: 1.6, strokeLinecap: "round" as const };
  switch (kind) {
    case "floral":
      return (
        <>
          <path d="M6 54C6 28 28 6 54 6" {...stroke} />
          <Flower x={16} y={16} r={7} fill="var(--accent-text)" center="var(--foil)" />
          <Leaf x={30} y={24} rot={110} s={0.5} fill="var(--accent-text)" />
          <Leaf x={24} y={34} rot={160} s={0.5} fill="var(--accent-text)" />
        </>
      );
    case "jali":
      return (
        <>
          {[14, 26, 38, 50].map((r) => (
            <path key={r} d={`M4 ${4 + r}A${r} ${r} 0 0 0 ${4 + r} 4`} {...stroke} />
          ))}
          <circle cx="12" cy="12" r="3" fill="var(--foil)" />
        </>
      );
    case "confetti":
      return (
        <>
          <circle cx="12" cy="14" r="4" fill="var(--foil)" />
          <rect x="26" y="8" width="10" height="5" rx="1.5" fill="var(--accent-text)" transform="rotate(25 31 10)" />
          <path d="M8 34l6-3 1 7Z" fill="var(--accent-text)" />
          <circle cx="42" cy="26" r="2.6" fill="var(--accent-text)" />
          <rect x="22" y="30" width="8" height="4" rx="1.5" fill="var(--foil)" transform="rotate(-30 26 32)" />
        </>
      );
    case "scallop":
      return (
        <>
          {[8, 20, 32, 44].map((cx) => (
            <circle key={`t${cx}`} cx={cx} cy="7" r="7" fill="color-mix(in srgb, var(--cover) 70%, var(--paper))" />
          ))}
          {[20, 32, 44].map((cy) => (
            <circle key={`l${cy}`} cx="7" cy={cy} r="7" fill="color-mix(in srgb, var(--cover) 70%, var(--paper))" />
          ))}
        </>
      );
    case "vine":
      return (
        <>
          <path d="M6 56C10 36 22 18 56 8" {...stroke} />
          {[[16, 40, 150], [24, 28, 120], [36, 18, 100]].map(([lx, ly, r], i) => (
            <Leaf key={i} x={lx as number} y={ly as number} rot={r as number} s={0.55} fill="var(--accent-text)" />
          ))}
          <circle cx="12" cy="22" r="2.6" fill="var(--foil)" />
        </>
      );
    case "lines":
      return (
        <>
          <path d="M5 38V5H38" {...stroke} />
          <path d="M12 30V12H30" {...stroke} strokeWidth={1} />
          <circle cx="5" cy="5" r="2.4" fill="var(--foil)" />
        </>
      );
  }
}

const CORNER_POSITIONS = [
  "top-1.5 left-1.5",
  "top-1.5 right-1.5 -scale-x-100",
  "bottom-1.5 left-1.5 -scale-y-100",
  "bottom-1.5 right-1.5 scale-[-1]",
];

function pagePattern(kind: PagePattern): CSSProperties {
  const a = (pct: number) => `color-mix(in srgb, var(--accent-text) ${pct}%, transparent)`;
  switch (kind) {
    case "dots":
      return { backgroundImage: `radial-gradient(circle at 1px 1px, ${a(18)} 1px, transparent 0)`, backgroundSize: "20px 20px" };
    case "polka":
      return { backgroundImage: `radial-gradient(circle, ${a(14)} 3px, transparent 3.5px)`, backgroundSize: "30px 30px" };
    case "stripes":
      return { backgroundImage: `repeating-linear-gradient(90deg, transparent 0 16px, ${a(7)} 16px 32px)` };
    case "diamonds":
      return {
        backgroundImage: `linear-gradient(45deg, ${a(8)} 25%, transparent 25% 75%, ${a(8)} 75%), linear-gradient(45deg, ${a(8)} 25%, transparent 25% 75%, ${a(8)} 75%)`,
        backgroundSize: "32px 32px",
        backgroundPosition: "0 0, 16px 16px",
      };
    case "gingham":
      return {
        backgroundImage: `linear-gradient(90deg, ${a(8)} 50%, transparent 50%), linear-gradient(${a(8)} 50%, transparent 50%)`,
        backgroundSize: "28px 28px",
      };
    default:
      return {};
  }
}

const AMBIENT_SHAPE: Record<Exclude<AmbientId, "none">, { cls: string; glyph?: string }> = {
  sparkle: { cls: "amb-twinkle", glyph: "✦" },
  stars: { cls: "amb-twinkle", glyph: "★" },
  petals: { cls: "amb-fall amb-petal" },
  confetti: { cls: "amb-fall amb-confetti" },
  leaves: { cls: "amb-fall amb-leaf" },
  balloons: { cls: "amb-rise amb-balloon" },
  hearts: { cls: "amb-rise amb-glyph", glyph: "♥" },
  clouds: { cls: "amb-drift amb-cloud" },
};

/** Gently moving decorations (falling petals, rising balloons, twinkling stars…). Pure CSS. */
function Ambient({ kind, colors }: { kind: Exclude<AmbientId, "none">; colors: string[] }) {
  const shape = AMBIENT_SHAPE[kind];
  const palette = colors.length > 0 ? colors : ["#d4a24c"];
  return (
    <div aria-hidden="true" className="amb-layer pointer-events-none absolute inset-0 overflow-hidden" style={{ containerType: "size" }}>
      {Array.from({ length: kind === "clouds" ? 5 : 14 }, (_, i) => {
        const style = {
          left: `${(i * 37 + 11) % 94}%`,
          top: shape.cls.includes("twinkle") || kind === "clouds" ? `${(i * 53 + 7) % 88}%` : undefined,
          color: palette[i % palette.length],
          "--c": palette[i % palette.length],
          "--dx": `${(i % 2 ? 1 : -1) * (14 + (i % 4) * 8)}px`,
          animationDuration: `${kind === "clouds" ? 26 + i * 4 : kind === "sparkle" || kind === "stars" ? 2.6 + (i % 4) * 0.7 : 9 + (i % 5) * 2.2}s`,
          animationDelay: `-${(i * 1.9) % 12}s`,
          fontSize: shape.glyph ? `${12 + (i % 4) * 4}px` : undefined,
        } as CSSProperties;
        return (
          <span key={i} className={`amb ${shape.cls}`} style={style}>
            {shape.glyph}
          </span>
        );
      })}
    </div>
  );
}

/** Background pattern, corner flourishes and floating decorations of a page. */
export function PageDecor({ design, moving }: { design: CardDesign; moving: boolean }) {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={pagePattern(design.pattern)} />
      {CORNER_POSITIONS.map((pos) => (
        <svg key={pos} viewBox="0 0 60 60" aria-hidden="true" className={`pointer-events-none absolute size-14 opacity-60 ${pos}`}>
          {corner(design.corner)}
        </svg>
      ))}
      {moving && design.ambient !== "none" && <Ambient kind={design.ambient} colors={design.ambientColors} />}
    </>
  );
}

/** The ornament divider that matches a design's corner style. */
export function ornamentFor(corner: CornerId): "lotus" | "diamond" | "vine" | "crescent" {
  switch (corner) {
    case "floral":
      return "lotus";
    case "jali":
      return "diamond";
    case "vine":
      return "vine";
    default:
      return "crescent";
  }
}

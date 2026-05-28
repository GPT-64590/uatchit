export function Sparkline({ data, w = 80, h = 28 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return <svg width={w} height={h} className="watch-sparkline" aria-hidden />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${h - 2 - ((v - min) / range) * (h - 6)}`)
    .join(" ");
  const id = `sp-${Math.abs(data.reduce((a, b) => a + b, 0)) % 1000}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="watch-sparkline" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(110,168,255,0.35)" />
          <stop offset="1" stopColor="rgba(110,168,255,0)" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="oklch(72% 0.14 245)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#${id})`} />
    </svg>
  );
}

'use client';
import { useState } from 'react';

interface SymbolData {
  symbol: string;
  count: number;
}

interface SymbolPieChartProps {
  data: SymbolData[];
  maxItems?: number;
}

const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#7C3AED', '#22D3EE'];
const seededExposure: SymbolData[] = [
  { symbol: 'EURUSD', count: 34 },
  { symbol: 'GBPUSD', count: 26 },
  { symbol: 'XAUUSD', count: 18 },
  { symbol: 'USDJPY', count: 14 },
  { symbol: 'BTCUSD', count: 8 },
];

function fixed(n: number, digits = 6): string {
  return n.toFixed(digits);
}

function toPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Number(fixed(cx + r * Math.cos(rad))),
    y: Number(fixed(cy + r * Math.sin(rad))),
  };
}

function donutArcPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startDeg: number,
  endDeg: number,
) {
  // A single 360deg SVG arc collapses (start=end), so draw it as two half arcs.
  if (Math.abs(endDeg - startDeg) >= 359.999) {
    const startOuter = toPoint(cx, cy, outerRadius, startDeg);
    const midOuter = toPoint(cx, cy, outerRadius, startDeg + 180);
    const endOuter = startOuter;
    const startInner = toPoint(cx, cy, innerRadius, startDeg);
    const midInner = toPoint(cx, cy, innerRadius, startDeg + 180);
    const endInner = startInner;
    return [
      `M ${fixed(startOuter.x)} ${fixed(startOuter.y)}`,
      `A ${fixed(outerRadius)} ${fixed(outerRadius)} 0 1 1 ${fixed(midOuter.x)} ${fixed(midOuter.y)}`,
      `A ${fixed(outerRadius)} ${fixed(outerRadius)} 0 1 1 ${fixed(endOuter.x)} ${fixed(endOuter.y)}`,
      `L ${fixed(endInner.x)} ${fixed(endInner.y)}`,
      `A ${fixed(innerRadius)} ${fixed(innerRadius)} 0 1 0 ${fixed(midInner.x)} ${fixed(midInner.y)}`,
      `A ${fixed(innerRadius)} ${fixed(innerRadius)} 0 1 0 ${fixed(startInner.x)} ${fixed(startInner.y)}`,
      'Z',
    ].join(' ');
  }

  const p1 = toPoint(cx, cy, outerRadius, startDeg);
  const p2 = toPoint(cx, cy, outerRadius, endDeg);
  const p3 = toPoint(cx, cy, innerRadius, endDeg);
  const p4 = toPoint(cx, cy, innerRadius, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return [
    `M ${fixed(p1.x)} ${fixed(p1.y)}`,
    `A ${fixed(outerRadius)} ${fixed(outerRadius)} 0 ${largeArc} 1 ${fixed(p2.x)} ${fixed(p2.y)}`,
    `L ${fixed(p3.x)} ${fixed(p3.y)}`,
    `A ${fixed(innerRadius)} ${fixed(innerRadius)} 0 ${largeArc} 0 ${fixed(p4.x)} ${fixed(p4.y)}`,
    'Z',
  ].join(' ');
}

export function SymbolPieChart({ data, maxItems = 6 }: SymbolPieChartProps) {
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const source = Array.isArray(data) && data.some((d) => d.count > 0) ? data : seededExposure;
  const sortedAll = [...source].sort((a, b) => b.count - a.count);
  const sorted =
    sortedAll.length > maxItems
      ? [
          ...sortedAll.slice(0, Math.max(1, maxItems - 1)),
          {
            symbol: 'Other',
            count: sortedAll.slice(Math.max(1, maxItems - 1)).reduce((sum, item) => sum + item.count, 0),
          },
        ]
      : sortedAll;
  const total = sorted.reduce((sum, item) => sum + item.count, 0);

  if (sorted.length === 0 || total <= 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-slate-500">No data yet</p>
      </div>
    );
  }

  const width = 200;
  const height = 200;
  const cx = 100;
  const cy = 100;
  const outerRadius = 90;
  const innerRadius = 45;
  const arcLabelRadius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const arcLabelMinAngle = 18;

  let currentAngle = -90;
  const slices = sorted.map((item, i) => {
    const percentage = (item.count / total) * 100;
    const sliceAngle = (percentage / 100) * 360;
    const startDeg = currentAngle;
    const endDeg = currentAngle + sliceAngle;
    currentAngle = endDeg;

    const midDeg = startDeg + sliceAngle / 2;
    const labelPoint = toPoint(cx, cy, arcLabelRadius, midDeg);

    return {
      symbol: item.symbol,
      count: item.count,
      percentage,
      color: colors[i % colors.length],
      path: donutArcPath(cx, cy, outerRadius, innerRadius, startDeg, endDeg),
      showLabel: sliceAngle >= arcLabelMinAngle,
      labelX: fixed(labelPoint.x),
      labelY: fixed(labelPoint.y),
      midDeg,
    };
  });

  return (
    <div className="flex items-center justify-center gap-5">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[200px] w-[200px]"
        role="img"
        aria-label="Symbol exposure donut chart"
      >
        {slices.map((slice, i) => (
          <g
            key={`${slice.symbol}-${i}`}
            onMouseEnter={() => setHoveredSlice(i)}
            onMouseLeave={() => setHoveredSlice(null)}
            style={{
              cursor: 'pointer',
              transform:
                hoveredSlice === i
                  ? `translate(${Math.cos((slice.midDeg * Math.PI) / 180) * 6}px, ${Math.sin((slice.midDeg * Math.PI) / 180) * 6}px)`
                  : 'translate(0px, 0px)',
              transformOrigin: 'center center',
              transition: 'transform 180ms ease-out, filter 180ms ease-out',
              filter: hoveredSlice === i ? 'drop-shadow(0 0 8px rgba(16,185,129,0.45))' : 'none',
            }}
          >
            <path d={slice.path} fill={slice.color} opacity={hoveredSlice === i ? 1 : 0.94} />
            {slice.showLabel && (
              <text
                x={slice.labelX}
                y={slice.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-white text-[11px] font-bold"
              >
                {slice.count}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="w-[140px] space-y-1.5">
        {slices.map((slice, i) => (
          <div key={`legend-${slice.symbol}-${i}`} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
            <span className="flex-1 font-mono text-xs text-slate-300">{slice.symbol}</span>
            <span className="font-mono text-xs text-slate-500">{slice.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

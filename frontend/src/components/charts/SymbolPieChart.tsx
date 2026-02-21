'use client';

interface SymbolData {
  symbol: string;
  count: number;
}

interface SymbolPieChartProps {
  data: SymbolData[];
  maxItems?: number;
}

const colors = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#a855f7', // violet
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#3b82f6', // blue
];

export function SymbolPieChart({ data, maxItems = 6 }: SymbolPieChartProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, maxItems);
  const total = sorted.reduce((sum, item) => sum + item.count, 0);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-slate-500">No data yet</p>
      </div>
    );
  }

  let currentAngle = -90;
  const slices = sorted.map((item, i) => {
    const percentage = (item.count / total) * 100;
    const sliceAngle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const radius = 50;

    const x1 = 50 + radius * Math.cos(startRad);
    const y1 = 50 + radius * Math.sin(startRad);
    const x2 = 50 + radius * Math.cos(endRad);
    const y2 = 50 + radius * Math.sin(endRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;

    const pathData = [
      `M 50 50`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    const labelAngle = startAngle + sliceAngle / 2;
    const labelRad = (labelAngle * Math.PI) / 180;
    const labelRadius = 65;
    const labelX = 50 + labelRadius * Math.cos(labelRad);
    const labelY = 50 + labelRadius * Math.sin(labelRad);

    return {
      path: pathData,
      color: colors[i % colors.length],
      symbol: item.symbol,
      count: item.count,
      percentage,
      labelX,
      labelY,
    };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-32 h-32">
        {slices.map((slice, i) => (
          <g key={`${slice.symbol}-${i}`}>
            <path d={slice.path} fill={slice.color} opacity="0.8" />
            <text
              x={slice.labelX}
              y={slice.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-bold"
              fill="white"
              fontWeight="600"
            >
              {slice.percentage.toFixed(0)}%
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="space-y-1.5 w-full">
        {slices.map((slice, i) => (
          <div key={`legend-${slice.symbol}-${i}`} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-xs font-mono text-slate-300 flex-1">
              {slice.symbol}
            </span>
            <span className="text-xs font-mono text-slate-500">
              {slice.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

interface SymbolData {
  symbol: string;
  count: number;
}

interface SymbolPieChartProps {
  data: SymbolData[];
  maxItems?: number;
}

const colors = ['#4f5dff', '#10b981', '#06b6d4', '#a855f7', '#f59e0b', '#3b82f6'];

export function SymbolPieChart({ data, maxItems = 6 }: SymbolPieChartProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, maxItems);
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
  const cx = width / 2;
  const cy = height / 2;
  const radius = 72;
  const arcLabelRadius = radius * 0.6; // like arcLabelRadius: '60%'
  const arcLabelMinAngle = 35;

  let currentAngle = -90;
  const slices = sorted.map((item, i) => {
    const percentage = (item.count / total) * 100;
    const sliceAngle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;
    const pathData = [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`, 'Z'].join(' ');

    const labelAngle = startAngle + sliceAngle / 2;
    const labelRad = (labelAngle * Math.PI) / 180;

    return {
      path: pathData,
      color: colors[i % colors.length],
      symbol: item.symbol,
      count: item.count,
      percentage,
      showLabel: sliceAngle >= arcLabelMinAngle,
      labelX: cx + arcLabelRadius * Math.cos(labelRad),
      labelY: cy + arcLabelRadius * Math.sin(labelRad),
    };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[200px] w-[200px]"
        role="img"
        aria-label="Symbol exposure pie chart"
      >
        {slices.map((slice, i) => (
          <g key={`${slice.symbol}-${i}`}>
            <path d={slice.path} fill={slice.color} opacity="0.92" />
            {slice.showLabel && (
              <text
                x={slice.labelX}
                y={slice.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[12px] font-bold"
                fill="white"
              >
                {`${slice.percentage.toFixed(0)}%`}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="w-full space-y-1.5">
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

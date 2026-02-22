'use client';

interface MasterPerformanceChartProps {
  values: number[];
}

export default function MasterPerformanceChart({ values }: MasterPerformanceChartProps) {
  return <span className="hidden">{values.length}</span>;
}

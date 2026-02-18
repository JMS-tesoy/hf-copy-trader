'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, AreaSeries, type IChartApi } from 'lightweight-charts';
import { useTheme } from '@/lib/ThemeContext';

interface DataPoint {
  time: string; // YYYY-MM-DD or epoch
  value: number;
}

interface MiniAreaChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
}

export function MiniAreaChart({ data, color = '#22c55e', height = 160 }: MiniAreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = theme === 'dark';
    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#94a3b8' : '#64748b',
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { labelVisible: false },
        horzLine: { labelVisible: false },
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: color + '40',
      bottomColor: color + '05',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    if (data.length > 0) {
      series.setData(data as any);
      chart.timeScale().fitContent();
    }

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, color, height, theme]);

  return <div ref={containerRef} className="w-full" />;
}

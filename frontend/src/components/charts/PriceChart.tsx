'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, AreaSeries, type IChartApi } from 'lightweight-charts';
import { useTheme } from '@/lib/ThemeContext';

interface PricePoint {
  time: string;
  value: number;
}

interface PriceChartProps {
  data: PricePoint[];
  height?: number;
  title?: string;
}

export function PriceChart({ data, height = 400, title }: PriceChartProps) {
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
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
        horzLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: isDark ? '#475569' : '#cbd5e1', width: 1, style: 2 },
        horzLine: { color: isDark ? '#475569' : '#cbd5e1', width: 1, style: 2 },
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#22c55e',
      topColor: '#22c55e30',
      bottomColor: '#22c55e05',
      lineWidth: 2,
      priceLineVisible: true,
      priceLineColor: '#22c55e50',
      priceLineWidth: 1,
      priceLineStyle: 2,
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
  }, [data, height, theme]);

  return (
    <div>
      {title && (
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
      )}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

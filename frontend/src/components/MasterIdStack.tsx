'use client';

import { useMemo } from 'react';

interface MasterIdStackProps {
  masterIds: number[];
  onClick?: (masterId: number) => void;
}

const colorPalette = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-indigo-500',
];

function getMasterColor(masterId: number): string {
  return colorPalette[masterId % colorPalette.length];
}

export function MasterIdStack({ masterIds, onClick }: MasterIdStackProps) {
  const sortedMasterIds = useMemo(() => {
    return [...new Set(masterIds)].sort((a, b) => a - b);
  }, [masterIds]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {sortedMasterIds.slice(0, 3).map((masterId) => (
          <button
            key={masterId}
            onClick={() => onClick?.(masterId)}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getMasterColor(masterId)} hover:ring-2 hover:ring-white hover:ring-offset-2 hover:ring-offset-slate-900 transition-all cursor-pointer hover:z-10`}
            title={`Master #${masterId}`}
          >
            {masterId}
          </button>
        ))}
        {sortedMasterIds.length > 3 && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold bg-slate-700 hover:bg-slate-600 transition-colors cursor-pointer hover:ring-2 hover:ring-white hover:ring-offset-2 hover:ring-offset-slate-900">
            +{sortedMasterIds.length - 3}
          </div>
        )}
      </div>
    </div>
  );
}

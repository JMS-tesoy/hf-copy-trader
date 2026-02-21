'use client';

import { useMemo } from 'react';

interface Subscriber {
  id: number;
  name: string;
}

interface SubscriberStackProps {
  subscribers: Subscriber[];
  showLabel?: boolean;
  onSubscriberClick?: (subscriber: Subscriber) => void;
}

const colorPalette = [
  'bg-slate-600',
  'bg-slate-700',
  'bg-gray-600',
  'bg-gray-700',
  'bg-blue-700',
  'bg-indigo-700',
  'bg-emerald-700',
  'bg-teal-700',
  'bg-cyan-700',
  'bg-stone-700',
];

function getSubscriberColor(id: number): string {
  return colorPalette[id % colorPalette.length];
}

export function SubscriberStack({ subscribers, showLabel = false, onSubscriberClick }: SubscriberStackProps) {
  const displayedSubscribers = useMemo(() => {
    return subscribers.slice(0, 3);
  }, [subscribers]);

  if (subscribers.length === 0) {
    return (
      <div className="text-2xl font-bold text-white">0</div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-1.5">
        {displayedSubscribers.map((sub) => (
          <button
            key={sub.id}
            onClick={() => onSubscriberClick?.(sub)}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold ${getSubscriberColor(sub.id)} hover:ring-2 hover:ring-white hover:ring-offset-1 hover:ring-offset-slate-900 transition-all cursor-pointer hover:scale-110`}
            title={sub.name}
          >
            {sub.name.charAt(0).toUpperCase()}
          </button>
        ))}
        {subscribers.length > 3 && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold bg-slate-700 hover:bg-slate-600 transition-colors hover:ring-2 hover:ring-white hover:ring-offset-1 hover:ring-offset-slate-900 cursor-default">
            +{subscribers.length - 3}
          </div>
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-slate-400">
          {subscribers.length} {subscribers.length === 1 ? 'subscriber' : 'subscribers'}
        </span>
      )}
    </div>
  );
}

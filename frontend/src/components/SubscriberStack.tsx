'use client';

import { useMemo } from 'react';

interface Subscriber {
  id: number;
  name: string;
}

interface SubscriberStackProps {
  subscribers: Subscriber[];
  showLabel?: boolean;
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

function getSubscriberColor(id: number): string {
  return colorPalette[id % colorPalette.length];
}

export function SubscriberStack({ subscribers, showLabel = false }: SubscriberStackProps) {
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
      <div className="flex -space-x-2">
        {displayedSubscribers.map((sub) => (
          <div
            key={sub.id}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getSubscriberColor(sub.id)} hover:ring-2 hover:ring-white hover:ring-offset-2 hover:ring-offset-slate-900 transition-all`}
            title={sub.name}
          >
            {sub.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {subscribers.length > 3 && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold bg-slate-700 hover:bg-slate-600 transition-colors hover:ring-2 hover:ring-white hover:ring-offset-2 hover:ring-offset-slate-900">
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

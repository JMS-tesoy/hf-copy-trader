'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  timestamp: Date;
}

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  onClear: () => void;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function NotificationCenter({ open, onClose, notifications, onClear }: NotificationCenterProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden animate-fade-in-down"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
          <button onClick={onClose} className="hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg p-1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400 dark:text-slate-500">
            No notifications
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className="px-4 py-3 border-b border-gray-50 dark:border-slate-800/50 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium">{n.title}</p>
                <span className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0 ml-2">
                  {timeAgo(n.timestamp)}
                </span>
              </div>
              {n.message && (
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{n.message}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

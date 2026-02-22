'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface Subscriber {
  id: number;
  name: string;
  email?: string;
  balance?: number;
  created_at?: string;
}

interface SubscriberProfileModalProps {
  subscriber: Subscriber | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriberProfileModal({ subscriber, isOpen, onClose }: SubscriberProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Subscriber | null>(null);

  useEffect(() => {
    if (subscriber && isOpen) {
      setLoading(true);
      setProfile(subscriber);
      setLoading(false);
    }
  }, [subscriber, isOpen]);

  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 animate-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Subscriber Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-400 hover:text-white" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Profile Details */}
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Name</label>
                <p className="text-white text-sm mt-1">{profile.name}</p>
              </div>

              {profile.email && (
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Email</label>
                  <p className="text-slate-300 text-sm mt-1 break-all">{profile.email}</p>
                </div>
              )}

              {profile.balance !== undefined && (
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Balance</label>
                  <p className="text-emerald-400 text-sm mt-1 font-mono">${profile.balance.toLocaleString()}</p>
                </div>
              )}

              {profile.created_at && (
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Joined</label>
                  <p className="text-slate-300 text-sm mt-1">
                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full mt-6 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

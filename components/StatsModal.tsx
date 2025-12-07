import React, { useEffect, useState } from 'react';
import { X, TrendingUp, Shield, Clock, Database as DatabaseIcon } from 'lucide-react';
import { db } from '../services/dbService';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Stats {
  totalDevicesSeen: number;
  totalTracked: number;
  totalSessions: number;
  oldestSession: number | null;
}

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await db.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Clear all session history? This cannot be undone.')) {
      try {
        await db.deleteOldSessions(0); // Delete all
        loadStats();
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DatabaseIcon className="w-6 h-6 text-cyt-accent" />
            Session Statistics
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading statistics...</div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <TrendingUp className="w-4 h-4" />
                    Devices Seen
                  </div>
                  <div className="text-2xl font-bold">{stats.totalDevicesSeen}</div>
                </div>

                <div className="bg-slate-800 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Shield className="w-4 h-4" />
                    Tracked
                  </div>
                  <div className="text-2xl font-bold text-cyt-red">{stats.totalTracked}</div>
                </div>

                <div className="bg-slate-800 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    Sessions
                  </div>
                  <div className="text-2xl font-bold">{stats.totalSessions}</div>
                </div>

                <div className="bg-slate-800 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <DatabaseIcon className="w-4 h-4" />
                    Oldest Data
                  </div>
                  <div className="text-sm font-bold">
                    {stats.oldestSession
                      ? `${Math.round((Date.now() - stats.oldestSession) / (1000 * 60 * 60 * 24))}d ago`
                      : 'N/A'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleClearHistory}
                className="w-full py-3 bg-red-900/20 border border-red-500/50 text-red-400 rounded-xl hover:bg-red-900/30 transition-colors"
              >
                Clear Session History
              </button>
            </>
          ) : (
            <div className="text-center py-8 text-red-400">Failed to load statistics</div>
          )}
        </div>
      </div>
    </div>
  );
};
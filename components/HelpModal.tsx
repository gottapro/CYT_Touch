import React from 'react';
import { X, HelpCircle, ShieldCheck, Eye, Activity, Trash2, Globe, Key } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center flex-none">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HelpCircle size={24} className="text-cyt-accent" />
            Tactical Guide
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-700 rounded-full text-white hover:bg-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          <div className="space-y-2">
            <h3 className="text-cyt-accent font-bold uppercase tracking-wider text-sm">1. Establish Baseline</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              When you start, the screen will be full of "Normal" traffic (Neighbors, your phone).
              Use the <strong className="text-white">TAIL</strong> button to ignore them.
            </p>
            <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
              <ShieldCheck className="text-slate-400" size={24} />
              <div className="text-sm text-slate-400">
                <span className="font-bold text-white">TAIL (Ignore):</span> Marks a device as "Safe". It vanishes from the main list.
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-cyt-accent font-bold uppercase tracking-wider text-sm">2. The Hunt</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Once the list is quiet, new devices are suspicious.
            </p>
            <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
              <Eye className="text-cyt-red" size={24} />
              <div className="text-sm text-slate-400">
                <span className="font-bold text-white">CHASE (Track):</span> Marks a device as a "Target". High priority tracking.
              </div>
            </div>
             <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
              <Activity className="text-cyt-blue" size={24} />
              <div className="text-sm text-slate-400">
                <span className="font-bold text-white">ANALYZE:</span> Ask AI to identify the device signature.
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-cyt-accent font-bold uppercase tracking-wider text-sm">3. Maintenance</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Moved to a new location? Old data cluttering the screen?
            </p>
            <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
              <Trash2 className="text-red-400" size={24} />
              <div className="text-sm text-slate-400">
                Go to <span className="font-bold text-white">Settings > Purge Kismet DB</span> to wipe the slate clean.
              </div>
            </div>
          </div>

          <div className="space-y-2">
             <h3 className="text-cyt-accent font-bold uppercase tracking-wider text-sm">4. External Intelligence</h3>
             
             <div className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700 mb-2">
              <Globe className="text-blue-400 mt-1" size={20} />
              <div className="text-sm text-slate-400">
                <span className="font-bold text-white">Wigle.net:</span> Used for geolocation lookup. No API key required in app, but you must be logged into Wigle.net in your browser.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
              <Key className="text-yellow-400 mt-1" size={20} />
              <div className="text-sm text-slate-400">
                <span className="font-bold text-white">AI Analysis Key:</span> Configured via the <code>.env</code> file (API_KEY=...). See Settings for status.
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-700 flex-none">
          <button onClick={onClose} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, Crosshair, XCircle } from 'lucide-react';
import { WifiDevice } from '../types';

interface RedAlertProps {
  device: WifiDevice | null;
  onDismiss: () => void;
  onChase: () => void;
}

export const RedAlert: React.FC<RedAlertProps> = ({ device, onDismiss, onChase }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (device) {
      setVisible(true);
      // Optional: Trigger vibration on mobile devices if supported
      if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 1000]);
    } else {
      setVisible(false);
    }
  }, [device]);

  if (!device || !visible) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-red-950/90 flex flex-col items-center justify-center p-6 animate-in fade-in duration-200 backdrop-blur-sm">
      
      {/* Pulsing Background Effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-red-600/20 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-red-600/50 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-red-600/50 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-md bg-black/80 border-4 border-red-500 rounded-3xl p-6 shadow-2xl shadow-red-900/50 flex flex-col items-center text-center space-y-6">
        
        {/* Siren Icon */}
        <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center animate-bounce shadow-[0_0_50px_rgba(220,38,38,0.6)]">
          <AlertTriangle size={48} className="text-white" />
        </div>

        <div>
          <h1 className="text-4xl font-black text-white tracking-wider uppercase mb-2 drop-shadow-lg">
            RED ALERT
          </h1>
          <p className="text-red-400 font-bold text-lg uppercase tracking-widest border-y-2 border-red-900/50 py-1">
            Proximity Warning
          </p>
        </div>

        {/* Target Info */}
        <div className="w-full bg-red-900/20 rounded-xl p-4 border border-red-500/30">
          <div className="text-sm text-red-300 font-mono mb-1">TARGET DETECTED</div>
          <div className="text-2xl font-bold text-white mb-1 truncate">{device.ssid || '<HIDDEN SSID>'}</div>
          <div className="flex justify-center gap-2 text-sm font-mono font-bold text-red-200/80">
            <span>{device.mac}</span>
            <span>•</span>
            <span>{device.vendor || 'UNKNOWN'}</span>
          </div>
          <div className="mt-3 text-3xl font-bold text-red-500 drop-shadow-md">
            {device.rssi} <span className="text-sm">dBm</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 w-full pt-2">
          <button 
            onClick={() => { onChase(); onDismiss(); }}
            className="py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-lg flex flex-col items-center justify-center gap-1 shadow-lg shadow-red-900/40 active:scale-95 transition-transform"
          >
            <Crosshair size={28} />
            ENGAGE
          </button>
          
          <button 
            onClick={onDismiss}
            className="py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-lg flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
          >
            <ShieldAlert size={28} />
            DISMISS
          </button>
        </div>

      </div>
    </div>
  );
};
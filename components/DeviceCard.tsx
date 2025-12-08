import React from 'react';
import { Wifi, ShieldAlert, ShieldCheck, Activity, Bluetooth, Globe, MapPin, Search, Link, Router, Crosshair } from 'lucide-react';
import { WifiDevice, ThreatLevel, DeviceType } from '../types';

interface DeviceCardProps {
  device: WifiDevice;
  onToggleIgnore: (mac: string) => void;
  onToggleTrack: (mac: string) => void;
  onAnalyze: (device: WifiDevice) => void;
}

export const DeviceCard = React.memo<DeviceCardProps>(({ device, onToggleIgnore, onToggleTrack, onAnalyze }) => {
  
  const getSignalColor = (rssi: number) => {
    if (rssi > -50) return 'text-green-400';
    if (rssi > -70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getThreatBorder = (level: ThreatLevel) => {
    switch (level) {
      case ThreatLevel.HIGH: return 'border-red-500 bg-red-900/10';
      case ThreatLevel.SUSPICIOUS: return 'border-orange-500 bg-orange-900/10';
      case ThreatLevel.SAFE: return 'border-green-800 bg-slate-800';
      default: return 'border-slate-700 bg-slate-800';
    }
  };

  const renderIcon = () => {
    if (device.type === DeviceType.BLUETOOTH || device.type === DeviceType.BLE) {
      return <Bluetooth size={28} className="text-blue-400" />;
    }
    if (device.type === DeviceType.AP) {
      return <Router size={28} className="text-purple-400" />;
    }
    return <Wifi size={28} />;
  };

  const handleWigleSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Search MAC on Wigle
    window.open(`https://wigle.net/search?netid=${device.mac}`, '_blank');
  };

  const handleProbeSearch = async (ssid: string) => {
    // 1. Try to copy to clipboard (Secure Context only)
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(ssid);
        copied = true;
      }
    } catch (e) {
      console.warn("Clipboard failed (likely non-HTTPS)", e);
    }

    // 2. Fallback for non-secure context (HTTP)
    if (!copied) {
       const manualCopy = window.prompt("Copy SSID for Wigle Search:", ssid);
       if (manualCopy === null) return; // User cancelled
    } else {
       // Non-blocking notification
       // We use a short timeout to allow the window.open to trigger first if possible, 
       // but alerts block. Let's just alert.
       alert(`SSID "${ssid}" copied to clipboard.`);
    }

    // 3. Open Wigle
    window.open(`https://wigle.net/`, '_blank');
  };

  // Persistence Color
  const getPersistenceColor = (score: number) => {
    if (score < 0.3) return 'bg-green-500';
    if (score < 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`relative flex flex-col p-4 mb-3 rounded-xl border-l-4 shadow-lg transition-all ${getThreatBorder(device.threatLevel)}`}>
      
      {/* Top Row: Icon, Main Info, Signal */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`p-3 rounded-full bg-slate-900 flex-shrink-0 ${getSignalColor(device.rssi)}`}>
            {renderIcon()}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-white font-mono tracking-wide truncate">
              {device.ssid || '<HIDDEN>'}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-300 font-mono bg-slate-900/50 px-1.5 py-0.5 rounded flex-shrink-0">{device.mac}</p>
              {device.type === DeviceType.BLE && <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-200 flex-shrink-0">BLE</span>}
              {device.type === DeviceType.AP && <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded flex-shrink-0 font-bold">AP</span>}
              {device.type === DeviceType.STATION && <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-200 flex-shrink-0">CLIENT</span>}
              <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold flex-shrink-0 ${
                device.timeWindow === 'recent' ? 'bg-green-900 text-green-300' :
                device.timeWindow === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                'bg-red-900 text-red-300'
              }`}>
                {device.timeWindow}
              </span>
            </div>
            <p className="text-sm text-cyt-accent uppercase tracking-wider font-semibold mt-0.5 truncate">{device.vendor || 'Unknown Vendor'}</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end min-w-[80px] pl-2">
          <span className={`text-2xl font-bold ${getSignalColor(device.rssi)}`}>
            {device.rssi} <span className="text-sm text-slate-500">dBm</span>
          </span>
          <div className="flex items-center gap-1 text-sm text-slate-400 mt-1 cursor-pointer hover:text-white" onClick={handleWigleSearch}>
             <Globe size={14} />
             <span className="underline">Wigle</span>
          </div>
        </div>
      </div>

      {/* Identity Correlation Alert */}
      {device.suspectedAlias && (
        <div className="mb-3 p-2 bg-orange-900/20 border border-orange-500/30 rounded flex items-center gap-2 text-orange-300 animate-pulse">
           <Link size={16} />
           <div className="text-xs">
             <span className="font-bold">IDENTITY MATCH:</span> Fingerprint matches {device.suspectedAlias}
           </div>
        </div>
      )}

      {/* GPS & Persistence Row */}
      <div className="flex items-center gap-4 mb-4">
         {device.gps && (
           <div className="flex items-center gap-1 text-xs text-slate-300 font-mono bg-slate-900/50 px-2 py-1.5 rounded">
              <MapPin size={14} className="text-cyt-accent" />
              {device.gps.lat.toFixed(5)}, {device.gps.lng.toFixed(5)}
           </div>
         )}
         <div className="flex-1">
            <div className="flex justify-between text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">
               <span>Persistence</span>
               <span>{Math.round(device.persistenceScore * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
               <div 
                  className={`h-full transition-all duration-1000 ${getPersistenceColor(device.persistenceScore)}`} 
                  style={{ width: `${device.persistenceScore * 100}%` }}
               />
            </div>
         </div>
      </div>

      {/* Probes Section (Origin Analysis) */}
      {device.probedSSIDs.length > 0 && (
        <div className="mb-4">
           <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1">
             <Search size={12} /> Probing For (Potential Home Base)
           </p>
           <div className="flex flex-wrap gap-2">
              {device.probedSSIDs.map((probe, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleProbeSearch(probe)}
                  className={`px-2.5 py-1 bg-slate-700 hover:bg-cyt-blue hover:text-white rounded text-xs text-slate-200 transition-colors border border-slate-600 truncate ${device.isTracked ? '' : 'max-w-[150px]'}`}
                  title="Search SSID on Wigle"
                >
                  {probe}
                </button>
              ))}
           </div>
        </div>
      )}

      {/* Action Buttons - Larger touch targets */}
      <div className="flex gap-3 mt-auto">
        <button 
          onClick={() => onToggleTrack(device.mac)}
          className={`flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors ${device.isTracked ? 'bg-cyt-red text-white shadow-lg shadow-red-900/20' : 'bg-slate-700 text-slate-300 active:bg-slate-600'}`}
        >
          <Crosshair size={20} />
          {device.isTracked ? 'CHASING' : 'Chase'}
        </button>
        
        <button 
          onClick={() => onToggleIgnore(device.mac)}
          className={`flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors ${device.isIgnored ? 'bg-slate-600 text-slate-400' : 'bg-slate-700 text-slate-300 active:bg-slate-600'}`}
        >
          {device.isIgnored ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
          {device.isIgnored ? 'Ignored' : 'Tail'}
        </button>

        <button 
          onClick={() => onAnalyze(device)}
          className="flex-none w-14 flex items-center justify-center bg-cyt-blue/20 text-cyt-blue rounded-xl border border-cyt-blue/50 active:bg-cyt-blue/40"
          aria-label="Analyze"
        >
          <Activity size={24} />
        </button>
      </div>
    </div>
  );
});
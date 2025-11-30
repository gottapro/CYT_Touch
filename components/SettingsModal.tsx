import React, { useState, useEffect } from 'react';
import { X, Save, Server, Zap, Trash2, Database, RefreshCw, Map, Download, ShieldCheck, AlertTriangle } from 'lucide-react';
import { AppSettings, WifiDevice } from '../types';
import { downloadKML } from '../services/kmlService';
import { isConfigured } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  devices?: WifiDevice[]; // Needed for KML export
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, devices = [] }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [apiKeyPresent, setApiKeyPresent] = useState(false);

  useEffect(() => {
    setFormData(settings);
    setApiKeyPresent(isConfigured());
  }, [settings, isOpen]);

  const handleChange = (key: keyof AppSettings, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const handlePurgeKismet = async () => {
    if (confirm("Execute Purge Command? This will request the bridge to restart services.")) {
       setActionStatus("Requesting Purge...");
       
       if (formData.isDemoMode) {
          setTimeout(() => setActionStatus("Demo Purge Complete"), 1000);
          setTimeout(() => setActionStatus(null), 3000);
          return;
       }

       try {
         const bridgeUrl = formData.dataSourceUrl.replace('/devices', '/purge');
         const res = await fetch(bridgeUrl, { method: 'POST' });
         if (res.ok) {
           setActionStatus("Command Executed.");
         } else {
           setActionStatus("Bridge Error.");
         }
       } catch (e) {
         setActionStatus("Connection Failed.");
       }
       setTimeout(() => setActionStatus(null), 3000);
    }
  };

  const handleClearLocal = () => {
     localStorage.removeItem('cyt_settings');
     window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server size={24} className="text-cyt-accent" />
            System Configuration
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-700 rounded-full text-white hover:bg-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
          
          {/* Mode Selection */}
          <div className="space-y-3">
             <label className="text-sm uppercase font-bold text-slate-500 tracking-wider">Operation Mode</label>
             <div className="flex gap-2">
                <button 
                  onClick={() => handleChange('isDemoMode', true)}
                  className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.isDemoMode ? 'bg-cyt-blue/20 border-cyt-blue text-cyt-blue' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                   <Zap size={24} />
                   <span className="font-bold">Demo Mode</span>
                   <span className="text-xs opacity-70">Simulated Traffic</span>
                </button>
                <button 
                  onClick={() => handleChange('isDemoMode', false)}
                  className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${!formData.isDemoMode ? 'bg-cyt-red/20 border-cyt-red text-cyt-red' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                   <Server size={24} />
                   <span className="font-bold">Live Mode</span>
                   <span className="text-xs opacity-70">Kismet/Hardware</span>
                </button>
             </div>
          </div>

          {/* AI Configuration Status */}
          <div className="space-y-3">
             <label className="text-sm uppercase font-bold text-slate-500 tracking-wider">AI Analysis Module</label>
             <div className={`p-4 rounded-xl border flex items-center gap-4 ${apiKeyPresent ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
                {apiKeyPresent ? (
                  <ShieldCheck className="text-green-500 flex-none" size={24} />
                ) : (
                  <AlertTriangle className="text-red-500 flex-none" size={24} />
                )}
                <div>
                  <div className={`font-bold ${apiKeyPresent ? 'text-green-400' : 'text-red-400'}`}>
                    {apiKeyPresent ? 'API Key Active' : 'API Key Missing'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {apiKeyPresent 
                      ? 'Gemini AI services are fully operational.' 
                      : 'Create a .env file with VITE_API_KEY to enable AI analysis.'}
                  </div>
                </div>
             </div>
          </div>

          {/* Intelligence Export */}
          <div className="space-y-3">
            <label className="text-sm uppercase font-bold text-slate-500 tracking-wider flex items-center gap-2">
              <Map size={16} /> Intelligence Export
            </label>
            <button 
              onClick={() => downloadKML(devices)}
              className="w-full p-4 bg-slate-800 border border-slate-600 hover:border-cyt-accent hover:bg-slate-700 rounded-xl flex items-center justify-between group transition-all"
            >
              <div className="flex flex-col items-start">
                <span className="font-bold text-white group-hover:text-cyt-accent transition-colors">Download KML Data</span>
                <span className="text-xs text-slate-400">Google Earth / GIS Compatible</span>
              </div>
              <Download size={20} className="text-slate-400 group-hover:text-cyt-accent" />
            </button>
          </div>

          {/* Live Data Source */}
          <div className={`space-y-3 transition-opacity ${formData.isDemoMode ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <label className="text-sm uppercase font-bold text-slate-500 tracking-wider">Live Data URL</label>
            <input 
              type="text"
              value={formData.dataSourceUrl}
              onChange={(e) => handleChange('dataSourceUrl', e.target.value)}
              placeholder="http://localhost:2501"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-cyt-accent focus:ring-1 focus:ring-cyt-accent outline-none font-mono text-sm"
            />
          </div>

          <hr className="border-slate-700" />

          {/* System Maintenance */}
           <div className="space-y-3">
             <label className="text-sm uppercase font-bold text-slate-500 tracking-wider flex items-center gap-2">
                <Database size={16} /> System Maintenance
             </label>
             <div className="grid grid-cols-2 gap-3">
                <button 
                   onClick={handlePurgeKismet}
                   className="p-3 bg-red-900/20 border border-red-900/50 hover:bg-red-900/30 text-red-400 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
                >
                   <Trash2 size={20} />
                   <span className="text-xs font-bold">Purge Kismet DB</span>
                </button>
                <button 
                   onClick={handleClearLocal}
                   className="p-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
                >
                   <RefreshCw size={20} />
                   <span className="text-xs font-bold">Reset App</span>
                </button>
             </div>
             {actionStatus && <p className="text-xs text-green-400 text-center animate-pulse">{actionStatus}</p>}
           </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-700">
          <button 
            onClick={handleSave} 
            className="w-full py-3 bg-cyt-green hover:bg-green-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Save size={20} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
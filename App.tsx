import React, { useState } from 'react';
import { Radar, Settings, Play, Square, HelpCircle, Thermometer, Database, ArrowUpDown, ShieldAlert, RefreshCw } from 'lucide-react';
import useDeviceStore from './stores/deviceStore';
import { useKismet } from './hooks/useKismet';
import { usePersistence } from './hooks/usePersistence';
import { DeviceCard } from './components/DeviceCard';
import { AnalysisModal } from './components/AnalysisModal';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { RedAlert } from './components/RedAlert';
import { DeviceSearch } from './components/DeviceSearch';
import { StatsModal } from './components/StatsModal';
import { Device } from './types';
import { analyzeDeviceSignature } from './services/geminiService';

const App: React.FC = () => {
  // --- HOOKS ---
  const {
    filteredDevices,
    activeFilters,
    isScanning,
    error,
    setSearchTerm,
    setSortCriteria,
    toggleShowBle,
    toggleShowClients,
    toggleShowAps,
    setScanning,
    setError
  } = useDeviceStore();

  const { startScan, stopScan } = useKismet();
  usePersistence(); // Handles DB loading and saving automatically

  // --- LOCAL UI STATE ---
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // --- HANDLERS ---
  const handleToggleScan = () => {
    if (isScanning) {
      stopScan();
      setScanning(false);
    } else {
      startScan();
      setScanning(true);
    }
  };
  
  const handleAnalyze = async (device: Device) => {
    setSelectedDevice(device);
    setAnalysisModalOpen(true);
    setAnalyzing(true);
    const result = await analyzeDeviceSignature(device);
    setAnalysisResult(result);
    setAnalyzing(false);
  };
  
  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gray-900 text-slate-200 font-sans">
      <RedAlert device={null} onDismiss={() => {}} onChase={() => {}} />

      <header className="fixed top-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-b border-slate-800 z-40 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg text-cyt-accent ${isScanning ? 'bg-cyt-accent/20' : 'bg-slate-800'}`}>
            <Radar size={24} className={isScanning ? "animate-spin-slow" : ""} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">CYT Touch</h1>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${isScanning ? (error ? 'bg-red-500' : 'bg-green-500 animate-pulse') : 'bg-slate-500'}`}></span>
                  <span className="text-xs text-slate-400 font-mono">
                    {isScanning ? (error ? 'ERROR' : 'LIVE') : 'IDLE'}
                  </span>
               </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setStatsModalOpen(true)} className="p-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors active:scale-95" title="Statistics">
             <Database size={22} />
           </button>
           <button onClick={() => setHelpModalOpen(true)} className="p-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors active:scale-95" title="Help">
             <HelpCircle size={22} />
           </button>
           <button onClick={() => setSettingsModalOpen(true)} className="p-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors active:scale-95" title="Settings">
             <Settings size={22} />
           </button>
        </div>
      </header>
      
      <main className="pt-24 px-4 max-w-3xl mx-auto">
        <div className="sticky top-20 z-30 bg-gray-900 py-2">
            <DeviceSearch
                value={activeFilters.searchTerm}
                onChange={setSearchTerm}
                totalDevices={filteredDevices.length}
                filteredCount={filteredDevices.length}
            />
             <div className="flex justify-center gap-2 mt-2">
                <button onClick={toggleShowBle} className={`px-3 py-1 text-xs rounded-full ${activeFilters.showBle ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    BLE/BT
                </button>
                <button onClick={toggleShowClients} className={`px-3 py-1 text-xs rounded-full ${activeFilters.showClients ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    Clients
                </button>
                <button onClick={toggleShowAps} className={`px-3 py-1 text-xs rounded-full ${activeFilters.showAps ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    APs
                </button>
             </div>
        </div>

        <div className="space-y-3 min-h-[50vh] mt-4">
          {filteredDevices.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <p>No devices matching filters.</p>
              {error && <p className="text-red-400 mt-4">{error}</p>}
            </div>
          ) : (
            filteredDevices.map(device => (
              <DeviceCard 
                key={device.mac} 
                device={device} 
                onAnalyze={handleAnalyze}
                onToggleIgnore={() => { /* Implement ignore logic in store */ }}
                onToggleTrack={() => { /* Implement track logic in store */ }}
              />
            ))
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-slate-800 p-4 z-50">
         <div className="max-w-3xl mx-auto flex gap-4">
            <button onClick={handleToggleScan} className={`flex-1 py-4 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 ${isScanning ? 'bg-red-500' : 'bg-green-500'}`}>
              {isScanning ? <Square size={24} /> : <Play size={24} />}
              {isScanning ? 'STOP' : 'START SCAN'}
            </button>
            <button onClick={() => setSortCriteria(activeFilters.sortCriteria === 'activity' ? 'signal' : activeFilters.sortCriteria === 'signal' ? 'age' : 'activity')} className="p-4 bg-slate-800 rounded-2xl">
              <ArrowUpDown size={28} />
            </button>
         </div>
      </div>
      
      <AnalysisModal 
        isOpen={analysisModalOpen} 
        onClose={() => setAnalysisModalOpen(false)}
        isLoading={analyzing}
        result={analysisResult}
        device={selectedDevice}
      />
      <SettingsModal 
        isOpen={settingsModalOpen} 
        onClose={() => setSettingsModalOpen(false)}
        settings={{isDemoMode: false, refreshRate: 5000}}
        onSave={() => {}}
        devices={[]}
      />
      <StatsModal isOpen={statsModalOpen} onClose={() => setStatsModalOpen(false)} />
      <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
    </div>
  );
};

export default App;
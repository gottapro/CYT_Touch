import React from 'react';
import { X, Bot, AlertTriangle, CheckCircle } from 'lucide-react';
import { AnalysisResult, WifiDevice } from '../types';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AnalysisResult | null;
  isLoading: boolean;
  device: WifiDevice | null;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, result, isLoading, device }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 text-cyt-accent">
            <Bot size={24} />
            <h2 className="text-xl font-bold">AI Signal Analysis</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-700 rounded-full text-white hover:bg-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-12 h-12 border-4 border-cyt-blue border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 animate-pulse">Analyzing signal signature...</p>
            </div>
          ) : result && device ? (
            <div className="space-y-6">
               <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
                  <div className="text-sm text-slate-400 font-mono">{device.mac}</div>
                  <div className="text-sm font-bold text-white">{device.vendor}</div>
               </div>

               <div className="space-y-2">
                 <h3 className="text-sm uppercase tracking-wider text-slate-500 font-bold">Assessment</h3>
                 <p className="text-lg leading-relaxed text-slate-200">{result.summary}</p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                    <div className="text-slate-500 text-xs uppercase mb-1">Threat Score</div>
                    <div className={`text-3xl font-bold ${result.threatScore > 50 ? 'text-red-500' : 'text-green-500'}`}>
                      {result.threatScore}<span className="text-sm text-slate-600">/100</span>
                    </div>
                 </div>
                 <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                    <div className="text-slate-500 text-xs uppercase mb-1">Recommendation</div>
                    <div className="font-bold text-cyt-blue">{result.recommendation}</div>
                 </div>
               </div>
            </div>
          ) : (
            <div className="text-center text-red-400">Analysis failed or no data available.</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-700">
          <button onClick={onClose} className="w-full py-3 bg-cyt-blue hover:bg-blue-600 text-white font-bold rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
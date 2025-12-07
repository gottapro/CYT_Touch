import React, { useState, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';

interface DeviceSearchProps {
  value: string;
  onChange: (value: string) => void;
  totalDevices: number;
  filteredCount: number;
}

export const DeviceSearch: React.FC<DeviceSearchProps> = ({ 
  value, 
  onChange, 
  totalDevices,
  filteredCount 
}) => {
  const [localValue, setLocalValue] = useState(value);

  // Debounce: Only update parent after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue]); // Remove onChange from deps

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder="Search MAC, SSID, or Vendor..."
          className="w-full pl-11 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyt-accent focus:ring-1 focus:ring-cyt-accent outline-none transition-colors"
        />
        {localValue && (
          <button
            onClick={() => {
              setLocalValue('');
              onChange('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      
      {/* Results Counter */}
      {localValue && (
        <div className="mt-2 text-sm text-slate-400 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Showing {filteredCount} of {totalDevices} devices
        </div>
      )}
    </div>
  );
};
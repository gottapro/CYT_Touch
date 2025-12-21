import { create } from 'zustand';
import { Device } from '../types';

export type DeviceSortCriteria = 'activity' | 'signal' | 'age';

interface DeviceState {
  devices: Record<string, Device>;
  filteredDevices: Device[];
  activeFilters: {
    searchTerm: string;
    sortCriteria: DeviceSortCriteria;
    showBle: boolean;
    showClients: boolean;
    showAps: boolean;
  };
  isLoading: boolean;
  isScanning: boolean;
  error: string | null;
  lastUpdated: number | null;

  setDevices: (devices: Record<string, Device>) => void;
  updateDevice: (device: Device) => void;
  applyFilters: () => void;
  setSearchTerm: (searchTerm: string) => void;
  setSortCriteria: (sortCriteria: DeviceSortCriteria) => void;
  toggleShowBle: () => void;
  toggleShowClients: () => void;
  toggleShowAps: () => void;
  setScanning: (isScanning: boolean) => void;
  setError: (error: string | null) => void;
}

const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: {},
  filteredDevices: [],
  activeFilters: {
    searchTerm: '',
    sortCriteria: 'activity',
    showBle: true,
    showClients: true,
    showAps: true,
  },
  isLoading: true,
  isScanning: false,
  error: null,
  lastUpdated: null,

  setDevices: (devices) => {
    set({ devices, isLoading: false, lastUpdated: Date.now() });
    get().applyFilters();
  },

  updateDevice: (device) => {
    set((state) => ({
      devices: { ...state.devices, [device.mac]: device },
      lastUpdated: Date.now(),
    }));
    get().applyFilters();
  },

  setSearchTerm: (searchTerm) => {
    set((state) => ({ activeFilters: { ...state.activeFilters, searchTerm } }));
    get().applyFilters();
  },

  setSortCriteria: (sortCriteria) => {
    set((state) => ({ activeFilters: { ...state.activeFilters, sortCriteria } }));
    get().applyFilters();
  },
  
  toggleShowBle: () => {
    set((state) => ({ activeFilters: { ...state.activeFilters, showBle: !state.activeFilters.showBle } }));
    get().applyFilters();
  },

  toggleShowClients: () => {
    set((state) => ({ activeFilters: { ...state.activeFilters, showClients: !state.activeFilters.showClients } }));
    get().applyFilters();
  },

  toggleShowAps: () => {
    set((state) => ({ activeFilters: { ...state.activeFilters, showAps: !state.activeFilters.showAps } }));
    get().applyFilters();
  },
  
  setScanning: (isScanning) => set({ isScanning }),
  setError: (error) => set({ error }),

  applyFilters: () => {
    const { devices, activeFilters } = get();
    let deviceArray = Object.values(devices);

    // 1. Filter by search term
    if (activeFilters.searchTerm) {
      const term = activeFilters.searchTerm.toLowerCase();
      deviceArray = deviceArray.filter(d =>
        d.mac.toLowerCase().includes(term) ||
        d.vendor.toLowerCase().includes(term) ||
        d.name.toLowerCase().includes(term) ||
        d.probedSSIDs.some(s => s.toLowerCase().includes(term))
      );
    }

    // 2. Filter by type
    deviceArray = deviceArray.filter(d => {
        const isBle = d.type.toLowerCase().includes('bluetooth') || d.type.toLowerCase().includes('ble');
        const isAp = d.type.toLowerCase() === 'wi-fi ap';
        const isClient = d.type.toLowerCase() === 'wi-fi client';

        if (isBle && activeFilters.showBle) return true;
        if (isAp && activeFilters.showAps) return true;
        if (isClient && activeFilters.showClients) return true;
        
        // Show devices that don't fit neatly if all filters are on
        if (!isBle && !isAp && !isClient && activeFilters.showBle && activeFilters.showAps && activeFilters.showClients) return true;

        return false;
    });


    // 3. Sort
    switch (activeFilters.sortCriteria) {
      case 'signal':
        deviceArray.sort((a, b) => b.rssi - a.rssi);
        break;
      case 'age':
        deviceArray.sort((a, b) => b.firstSeen - a.firstSeen);
        break;
      case 'activity':
      default:
        deviceArray.sort((a, b) => b.lastSeen - a.lastSeen);
        break;
    }
    
    set({ filteredDevices: deviceArray });
  },
}));

export default useDeviceStore;

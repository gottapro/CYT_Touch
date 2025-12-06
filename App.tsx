import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Radar, Settings, Play, Square, Search, AlertCircle, RefreshCw, HelpCircle, Thermometer, EyeOff } from 'lucide-react';
import { WifiDevice, DeviceType, ThreatLevel, AnalysisResult, AppSettings, GPSCoordinate } from './types';
import { DeviceCard } from './components/DeviceCard';
import { AnalysisModal } from './components/AnalysisModal';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { RedAlert } from './components/RedAlert';
import { analyzeDeviceSignature } from './services/geminiService';
import { DeviceSearch } from './components/DeviceSearch';

const isDev = import.meta.env.DEV;

const logger = {
  debug: (...args: any[]) => isDev && console.log('[DEBUG]', ...args),
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args)
};

// --- CONFIGURATION & HEURISTICS ---

const KNOWN_THREAT_VENDORS = [
  'Flipper Devices', 
  'Hak5', 
  'Pine64', 
  'Espressif', 
  'DJI Technology', 
  'Autel Robotics',
  'Parrot',
  'Yuneec',
  'ALFA Network',
  'Ubiquiti',
  'Shenzhen'
];

const assessThreatLevel = (vendor: string = '', ssid: string = '', rssi: number): ThreatLevel => {
  const v = vendor.toLowerCase();
  
  // 1. Critical Threats (Hardware Signatures)
  if (KNOWN_THREAT_VENDORS.some(t => v.includes(t.toLowerCase()))) return ThreatLevel.HIGH;
  
  // 2. Suspicious Signatures (Hidden high power)
  if (!ssid && rssi > -50) return ThreatLevel.SUSPICIOUS;
  
  return ThreatLevel.UNKNOWN;
};

// --- MOCK DATA GENERATOR ---
const MOCK_VENDORS = ['Apple', 'Samsung', 'Intel', 'Espressif', 'Google', 'Unknown', 'TP-Link', 'DJI Technology', 'Flipper Devices', 'Tile', 'Fitbit'];
const MOCK_SSIDS = ['Home_WiFi', 'Free_Public', 'Starbucks', 'iPhone (13)', 'Hidden Network', 'Surveillance_Cam_01', 'Skynet_Link', '', 'Tello-Drones'];
const MOCK_PROBES = ['Netgear', 'Linksys', 'Starbucks_WiFi', 'CorpNet_Secure', 'My_Home', 'AttWifi', 'Xfinity', 'FBI_Van', 'Skynet'];

const generateRandomDevice = (currentLat: number, currentLng: number): WifiDevice => {
  const mac = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':').toUpperCase();
  const isDrone = Math.random() > 0.95;
  const isBluetooth = Math.random() > 0.7;
  
  let vendor = MOCK_VENDORS[Math.floor(Math.random() * MOCK_VENDORS.length)];
  let ssid = Math.random() > 0.3 ? MOCK_SSIDS[Math.floor(Math.random() * MOCK_SSIDS.length)] : undefined;
  
  if (isDrone) { vendor = 'DJI Technology'; ssid = 'Mavic_Pro_Video'; }

  const threatLevel = assessThreatLevel(vendor, ssid, -Math.floor(Math.random() * 60) - 30);
  
  // Generate random probes
  const probedSSIDs = [];
  if (Math.random() > 0.5) {
    const numProbes = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numProbes; i++) {
      probedSSIDs.push(MOCK_PROBES[Math.floor(Math.random() * MOCK_PROBES.length)]);
    }
  }

  return {
    mac,
    ssid,
    rssi: -Math.floor(Math.random() * 60) - 30,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    vendor,
    type: isBluetooth ? DeviceType.BLE : (isDrone ? DeviceType.DRONE : DeviceType.STATION),
    threatLevel: threatLevel === ThreatLevel.UNKNOWN ? ThreatLevel.SAFE : threatLevel,
    isIgnored: false,
    isTracked: threatLevel === ThreatLevel.HIGH,
    probedSSIDs,
    gps: { lat: currentLat + (Math.random() - 0.5) * 0.001, lng: currentLng + (Math.random() - 0.5) * 0.001 },
    gpsHistory: [],
    persistenceScore: 0.0,
    timeWindow: 'recent'
  };
};

const DEFAULT_SETTINGS: AppSettings = {
  isDemoMode: true,
  dataSourceUrl: 'http://localhost:5000/devices',
  refreshRate: 8000
};

const App: React.FC = () => {
  // --- STATE ---
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('cyt_settings');
    // Force update refreshRate if it's the old default to ensure users get the new stability fix
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    if (parsed.refreshRate < 5000) parsed.refreshRate = 8000;
    return parsed;
  });

  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<WifiDevice[]>([]);
  const [filter, setFilter] = useState<'all' | 'tracked' | 'ignored'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'idle'>('idle');
  const [cpuTemp, setCpuTemp] = useState<number | null>(null);
  
  // Modals
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  
  // Red Alert State
  const [redAlertDevice, setRedAlertDevice] = useState<WifiDevice | null>(null);
  const dismissedAlertsRef = useRef<Set<string>>(new Set());

  // Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<WifiDevice | null>(null);
  
  // Geolocation
  const userLocation = useRef({ lat: 34.0522, lng: -118.2437 });
  const scanIntervalRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  
  // Ref to track latest devices for the interval closure
  const devicesRef = useRef(devices);
  useEffect(() => {
      devicesRef.current = devices;
  }, [devices]);

  // --- EFFECTS ---
  useEffect(() => {
    // Initial Load
    if (settings.isDemoMode) {
       // Start with a few devices
       const initials = Array.from({length: 3}, () => generateRandomDevice(userLocation.current.lat, userLocation.current.lng));
       setDevices(initials);
    }
  }, [settings.isDemoMode]);

  useEffect(() => {
    localStorage.setItem('cyt_settings', JSON.stringify(settings));
  }, [settings]);

  // Clean up GPS watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (scanIntervalRef.current) window.clearInterval(scanIntervalRef.current);
    };
  }, []);

  // --- LOGIC ---
  
  // Haversine Formula to calculate distance in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const calculatePersistence = (firstSeen: number, lastSeen: number): number => {
    const durationMinutes = (lastSeen - firstSeen) / 1000 / 60;
    // Cap at 20 minutes for 100% score
    return Math.min(1.0, durationMinutes / 20);
  };

  const calculateTimeWindow = (firstSeen: number): 'recent' | 'medium' | 'old' | 'oldest' => {
    const ageMinutes = (Date.now() - firstSeen) / 1000 / 60;
    if (ageMinutes < 5) return 'recent';
    if (ageMinutes < 10) return 'medium';
    if (ageMinutes < 15) return 'old';
    return 'oldest';
  };

  // Check if two probe lists are similar enough to suspect same identity
  const findFingerprintMatch = (newProbes: string[], existingDevices: WifiDevice[]): WifiDevice | null => {
    if (newProbes.length < 2) return null; // Need at least 2 probes for a reliable fingerprint

    for (const existing of existingDevices) {
      if (existing.probedSSIDs.length < 2) continue;
      
      // Calculate intersection
      const intersection = newProbes.filter(p => existing.probedSSIDs.includes(p));
      const matchRatio = intersection.length / Math.max(newProbes.length, existing.probedSSIDs.length);
      
      // Heuristic: If >50% overlap or >=3 exact matches
      if (matchRatio > 0.5 || intersection.length >= 3) {
        return existing;
      }
    }
    return null;
  };

const updateDevices = useCallback((prevDevices: WifiDevice[], newReadings: WifiDevice[]) => {
  const now = Date.now();
  const map = new Map(prevDevices.map(d => [d.mac, d]));
  
  // Get current user location at time of update
  const currentUserLocation = userLocation.current;

  // Process new readings
  newReadings.forEach(reading => {
    let isNew = !map.has(reading.mac);
    let currentDevice = reading;

    if (!isNew) {
      const existingOriginal = map.get(reading.mac)!;
      const existing = { ...existingOriginal };

      existing.lastSeen = now;
      existing.rssi = reading.rssi;

      if (reading.gps) {
        const lastPos = existing.gps;
        if (lastPos) {
          const dist = calculateDistance(lastPos.lat, lastPos.lng, reading.gps.lat, reading.gps.lng);
          if (dist > 10) {
            // FIX #3: Limit GPS history to last 100 points
            existing.gpsHistory = [...(existing.gpsHistory || []), reading.gps].slice(-100);
          }
        } else {
          existing.gpsHistory = [reading.gps];
        }
        existing.gps = reading.gps;
      }

      // Use current location snapshot
      if (!existing.gps && currentUserLocation.lat !== 0) {
        existing.gps = { ...currentUserLocation };
      }

      existing.probedSSIDs = [...new Set([...existing.probedSSIDs, ...reading.probedSSIDs])];
      existing.persistenceScore = calculatePersistence(existing.firstSeen, now);
      existing.timeWindow = calculateTimeWindow(existing.firstSeen);

      if (existing.firstSeenUserPos) {
        // Keep it
      } else if (reading.firstSeenUserPos) {
        existing.firstSeenUserPos = reading.firstSeenUserPos;
      }

      // --- STALKER LOGIC (Fixed to use snapshot) ---
      if (!existing.isIgnored && existing.threatLevel !== ThreatLevel.HIGH) {
        const isPersistent = existing.persistenceScore > 0.75;

        let distanceTraveled = 0;
        if (existing.firstSeenUserPos && currentUserLocation.lat !== 0) {
          distanceTraveled = calculateDistance(
            existing.firstSeenUserPos.lat, existing.firstSeenUserPos.lng,
            currentUserLocation.lat, currentUserLocation.lng
          );
        }

        if (isPersistent && distanceTraveled > 500) {
          if (existing.threatLevel !== ThreatLevel.SUSPICIOUS) {
            existing.threatLevel = ThreatLevel.SUSPICIOUS;
            existing.isTracked = true;
            existing.notes = `Auto-Flagged: Followed for ${(distanceTraveled/1000).toFixed(1)}km`;
          }
        }
      }

      currentDevice = existing;
      map.set(reading.mac, existing);
    } else {
      // New Device
      currentDevice = { ...reading };

      if (!currentDevice.gps && currentUserLocation.lat !== 0) {
        currentDevice.gps = { ...currentUserLocation };
      }

      if (!currentDevice.firstSeenUserPos && currentUserLocation.lat !== 0) {
        currentDevice.firstSeenUserPos = { ...currentUserLocation };
      }

      const match = findFingerprintMatch(currentDevice.probedSSIDs, Array.from(map.values()));
      if (match) {
        currentDevice.suspectedAlias = match.mac;
        if (match.isTracked) {
          currentDevice.isTracked = true;
          currentDevice.notes = `Auto-tracked: Alias of ${match.mac}`;
        }
        if (match.threatLevel === ThreatLevel.HIGH || match.threatLevel === ThreatLevel.SUSPICIOUS) {
          currentDevice.threatLevel = match.threatLevel;
        }
      }

      map.set(currentDevice.mac, currentDevice);
    }

    // --- RED ALERT TRIGGER ---
    if (currentDevice.threatLevel === ThreatLevel.HIGH &&
        currentDevice.rssi > -65 &&
        !currentDevice.isIgnored &&
        !dismissedAlertsRef.current.has(currentDevice.mac)) {
      setRedAlertDevice(currentDevice);
    }
  });

  return Array.from(map.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}, []); // Empty dependency is now safe - we use snapshot pattern

  // Helper to parse diverse JSON formats (Native App format OR Kismet Raw format)
// Replace the parseBackendData function in App.tsx with this fixed version

const parseBackendData = (data: any): WifiDevice[] => {
  let list: any[] = [];

  // Case 1: Array (Our format or List of Kismet Objects)
  if (Array.isArray(data)) {
    list = data;
  }
  // Case 2: Kismet Object wrapper
  else if (data && Array.isArray(data.devices)) {
    list = data.devices;
  }

  return list.map((item: any) => {
    // A: Native App Format
    if (item.mac && typeof item.rssi === 'number') {
      return item as WifiDevice;
    }

    // B: Raw Kismet Format
    const mac = item['kismet.device.base.macaddr'] || item.macaddr;

    if (mac) {
      const signalObj = item['kismet.device.base.signal'];
      const rssi = (signalObj && signalObj['kismet.common.signal.last_signal'])
                || item.signal_rssi
                || -90;

      const name = item['kismet.device.base.name'] || item['kismet.device.base.commonname'] || item.name;
      const manuf = item['kismet.device.base.manuf'] || item.manuf || 'Unknown';

      // Extract GPS from Kismet if available (Avg Loc)
      let gps: GPSCoordinate | undefined = undefined;
      const loc = item['kismet.device.base.location'];
      if (loc && loc['kismet.common.location.avg_loc'] && loc['kismet.common.location.avg_loc']['kismet.common.location.geopoint']) {
        const point = loc['kismet.common.location.avg_loc']['kismet.common.location.geopoint']; // [lon, lat]
        if (Array.isArray(point) && point.length === 2 && point[0] !== 0) {
          gps = { lng: point[0], lat: point[1] };
        }
      }

      // Time handling
      const firstSeen = item['kismet.device.base.first_time'] ? item['kismet.device.base.first_time'] * 1000 : Date.now();
      const lastSeen = item['kismet.device.base.last_time'] ? item['kismet.device.base.last_time'] * 1000 : Date.now();

      // PHY Type Detection
      const phy = item['kismet.device.base.phyname'] || 'IEEE802.11';
      const kismetType = item['kismet.device.base.type'] || '';

      let type = DeviceType.STATION; // Default to Client/Station
      if (phy.includes('Bluetooth')) {
        type = phy.includes('LE') ? DeviceType.BLE : DeviceType.BLUETOOTH;
      } else if (kismetType === 'Wi-Fi AP') {
        type = DeviceType.AP;
      } else if (kismetType === 'Wi-Fi Bridged') {
        type = DeviceType.AP; // Treat bridged devices as infrastructure
      }

      // ========== FIX: Extract probed SSIDs from dot11.device ==========
      let probedSSIDs: string[] = [];
      
      // Check if dot11.device exists and contains probed_ssid_map
      const dot11Device = item['dot11.device'];
      if (dot11Device && dot11Device['dot11.device.probed_ssid_map']) {
        const probeMap = dot11Device['dot11.device.probed_ssid_map'];
        
        if (Array.isArray(probeMap)) {
          probedSSIDs = probeMap
            .map((probe: any) => {
              // Extract the SSID from the probe object
              const ssid = probe['dot11.probedssid.ssid'];
              return ssid;
            })
            .filter((ssid: string | null | undefined) => {
              // Filter out empty/null SSIDs
              return ssid && ssid.length > 0;
            });
        }
      }
      
      // Debug log for devices with probes (remove after confirming it works)
      if (probedSSIDs.length > 0) {
        logger.debug(`Device ${mac} probed SSIDs:`, probedSSIDs);
      }
      // ================================================================

      return {
        mac: mac,
        ssid: name,
        rssi: rssi,
        firstSeen: firstSeen,
        lastSeen: lastSeen,
        vendor: manuf,
        type: type,
        threatLevel: assessThreatLevel(manuf, name, rssi),
        isIgnored: false,
        isTracked: false,
        probedSSIDs: probedSSIDs,
        gps: gps,
        gpsHistory: gps ? [gps] : [],
        persistenceScore: 0,
        timeWindow: 'recent'
      } as WifiDevice;
    }

    return null;
  }).filter((d): d is WifiDevice => d !== null);
};

  const fetchSystemStats = async () => {
     try {
       // Assuming the bridge is running on the same host but port 5000
       const bridgeUrl = settings.dataSourceUrl.replace('/devices', '/system');
       const res = await fetch(bridgeUrl);
       if (res.ok) {
         const data = await res.json();
         if (data.cpu_temp) setCpuTemp(data.cpu_temp);
       }
     } catch(e) { /* ignore */ }
  };

  const fetchLiveData = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

      // Parallel fetch: Devices + System Stats
      fetchSystemStats();

      const response = await fetch(settings.dataSourceUrl, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rawData = await response.json();
      const newReadings = parseBackendData(rawData);
      
      if (newReadings.length > 0) {
        setDevices(prev => updateDevices(prev, newReadings));
        setConnectionStatus('connected');
      } else {
         console.warn("Fetched data but found no valid devices.");
         setConnectionStatus('connected'); // Still connected, just empty
      }

    } catch (e) {
      console.warn("Live fetch failed.", e);
      setConnectionStatus('error');
    }
  };

  const toggleScan = () => {
    if (isScanning) {
      // STOP SCANNING
      if (scanIntervalRef.current) window.clearInterval(scanIntervalRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      setIsScanning(false);
      setConnectionStatus('idle');
      setCpuTemp(null);
    } else {
      // START SCANNING
      setIsScanning(true);
      
      // Start Real-time GPS Watcher
      if (navigator.geolocation) {
         watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                userLocation.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            }, 
            (err) => console.log("GPS Denied or Error", err),
            { enableHighAccuracy: true, maximumAge: 10000 }
         );
      }

      scanIntervalRef.current = window.setInterval(async () => {
        if (settings.isDemoMode) {
           // Simulate movement
           userLocation.current.lat += (Math.random() - 0.5) * 0.0001;
           userLocation.current.lng += (Math.random() - 0.5) * 0.0001;
           setCpuTemp(45 + Math.random() * 5); // Simulate temp

           const readings: WifiDevice[] = [];
           // Use devicesRef.current to get the latest state inside the interval
           devicesRef.current.forEach(d => {
             if (Math.random() > 0.3) {
                const updated = {...d};
                if (updated.gps) {
                  updated.gps = { 
                    lat: updated.gps.lat + (Math.random() - 0.5) * 0.0001,
                    lng: updated.gps.lng + (Math.random() - 0.5) * 0.0001
                  };
                }
                readings.push(updated);
             }
           });

           if (Math.random() > 0.5) {
             const newDev = generateRandomDevice(userLocation.current.lat, userLocation.current.lng);
             if (Math.random() > 0.7 && devicesRef.current.length > 0) {
               const target = devicesRef.current[Math.floor(Math.random() * devicesRef.current.length)];
               if (target.probedSSIDs.length >= 2) {
                 newDev.probedSSIDs = [...target.probedSSIDs]; 
               }
             }
             readings.push(newDev);
           }
           setDevices(prev => updateDevices(prev, readings));

        } else {
          // LIVE MODE
          await fetchLiveData();
        }
      }, settings.refreshRate);
    }
  };

  const handleToggleIgnore = (mac: string) => {
    setDevices(prev => prev.map(d => d.mac === mac ? { ...d, isIgnored: !d.isIgnored, isTracked: false } : d));
  };

  const handleToggleTrack = (mac: string) => {
    setDevices(prev => prev.map(d => d.mac === mac ? { ...d, isTracked: !d.isTracked, isIgnored: false } : d));
  };

  const handleTailAll = () => {
    // Ignore all devices that are NOT currently being tracked
    setDevices(prev => prev.map(d => d.isTracked ? d : { ...d, isIgnored: true }));
  };

  const handleAnalyze = async (device: WifiDevice) => {
    if (analyzing) return; // Prevent double-taps
    setSelectedDevice(device);
    setAnalysisModalOpen(true);
    setAnalyzing(true);
    // Pass the configured data source URL so the service knows where the bridge is
    const result = await analyzeDeviceSignature(device, settings.dataSourceUrl);
    setAnalysisResult(result);
    setAnalyzing(false);
  };

  const handleDismissAlert = () => {
    if (redAlertDevice) {
       dismissedAlertsRef.current.add(redAlertDevice.mac);
       setRedAlertDevice(null);
    }
  };

  const visibleDevices = devices.filter(d => {
  // Apply tab filter first
  if (filter === 'ignored') {
    if (!d.isIgnored) return false;
  } else if (filter === 'tracked') {
    if (!d.isTracked) return false;
  } else {
    if (d.isIgnored) return false;
  }

  // Apply search filter if search term exists
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    const matchesMac = d.mac.toLowerCase().includes(term);
    const matchesSsid = d.ssid?.toLowerCase().includes(term);
    const matchesVendor = d.vendor?.toLowerCase().includes(term);
    const matchesProbes = d.probedSSIDs.some(ssid => 
      ssid.toLowerCase().includes(term)
    );
    
    return matchesMac || matchesSsid || matchesVendor || matchesProbes;
  }

  return true;
});

  return (
    <div className="min-h-screen bg-gray-900 text-slate-200 pb-28 font-sans selection:bg-cyt-accent selection:text-black">
      
      {/* --- RED ALERT OVERLAY --- */}
      <RedAlert 
        device={redAlertDevice} 
        onDismiss={handleDismissAlert} 
        onChase={() => {
          if (redAlertDevice) handleToggleTrack(redAlertDevice.mac);
        }}
      />

      {/* --- HEADER --- */}
      <header className="fixed top-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-b border-slate-800 z-40 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg text-cyt-accent ${isScanning ? 'bg-cyt-accent/20' : 'bg-slate-800'}`}>
            <Radar size={24} className={isScanning ? "animate-spin-slow" : ""} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">CYT Touch</h1>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    isScanning 
                      ? (settings.isDemoMode ? 'bg-green-500 animate-pulse' : (connectionStatus === 'error' ? 'bg-red-500' : 'bg-green-500 animate-pulse')) 
                      : 'bg-slate-500'
                  }`}></span>
                  <span className="text-xs text-slate-400 font-mono">
                    {isScanning 
                      ? (settings.isDemoMode ? 'DEMO' : (connectionStatus === 'error' ? 'ERROR' : 'LIVE')) 
                      : 'IDLE'}
                  </span>
               </div>
               
               {/* CPU Temp Indicator */}
               {cpuTemp !== null && (
                 <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
                   <Thermometer size={12} className={cpuTemp > 70 ? 'text-red-500' : 'text-slate-500'} />
                   <span className={cpuTemp > 70 ? 'text-red-400 font-bold' : ''}>{cpuTemp.toFixed(1)}°C</span>
                 </div>
               )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setHelpModalOpen(true)}
             className="p-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors active:scale-95"
           >
             <HelpCircle size={22} />
           </button>
           <button 
             onClick={() => setSettingsModalOpen(true)}
             className="p-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors active:scale-95"
           >
             <Settings size={22} />
           </button>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="pt-24 px-4 max-w-3xl mx-auto">
        
                {/* Filter Tabs */}
                <div className="flex p-1 bg-slate-800 rounded-xl mb-4 border border-slate-700 sticky top-20 z-30 shadow-lg">
                  <button 
                    onClick={() => setFilter('all')}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${filter === 'all' ? 'bg-slate-600 text-white shadow ring-1 ring-slate-500' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Nearby ({devices.filter(d => !d.isIgnored).length})
                  </button>
                  <button 
                    onClick={() => setFilter('tracked')}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${filter === 'tracked' ? 'bg-cyt-red text-white shadow ring-1 ring-red-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Chasing ({devices.filter(d => d.isTracked).length})
                  </button>
                  <button 
                    onClick={() => setFilter('ignored')}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${filter === 'ignored' ? 'bg-slate-600 text-white shadow ring-1 ring-slate-500' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Tail ({devices.filter(d => d.isIgnored).length})
                  </button>
                </div>
        
                {/* NEW: Search Bar */}
                <div className="mb-4">
                  <DeviceSearch 
                    value={searchTerm}
                    onChange={setSearchTerm}
                    totalDevices={devices.filter(d => {
                      if (filter === 'ignored') return d.isIgnored;
                      if (filter === 'tracked') return d.isTracked;
                      return !d.isIgnored;
                    }).length}
                    filteredCount={visibleDevices.length}
                  />
                </div>
        
                {/* Device List */}
                <div className="space-y-3 min-h-[50vh]">          {visibleDevices.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-500 opacity-60">
                <Search size={48} className="mb-4" />
                <p className="text-lg">No devices visible</p>
                {!isScanning && <p className="text-sm mt-2 text-cyt-accent">Tap Start to Scan</p>}
                
                {/* IMPROVED ERROR STATE */}
                {isScanning && !settings.isDemoMode && connectionStatus === 'error' && (
                  <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded-xl text-red-300 text-sm max-w-xs text-center shadow-lg">
                    <div className="flex justify-center mb-2"><AlertCircle size={32} /></div>
                    <p className="font-bold mb-2">Connection Failed</p>
                    <p className="mb-3 opacity-80">The browser cannot connect to Kismet directly due to security (CORS).</p>
                    <div className="bg-black/40 p-2 rounded text-left font-mono text-xs text-slate-400 mb-2">
                       python3 cyt_bridge.py
                    </div>
                    <p>Run the bridge script on your Pi, then check Settings URL is: <br/> <strong>{settings.dataSourceUrl}</strong></p>
                  </div>
                )}
             </div>
          ) : (
            visibleDevices.map(device => (
              <DeviceCard 
                key={device.mac} 
                device={device} 
                onToggleIgnore={handleToggleIgnore}
                onToggleTrack={handleToggleTrack}
                onAnalyze={handleAnalyze}
                isAnalyzing={analyzing}
              />
            ))
          )}
        </div>
        
        <div className="h-24"></div>
      </main>

      {/* --- STICKY FOOTER CONTROLS --- */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-slate-800 p-4 z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] safe-area-bottom">
         <div className="max-w-3xl mx-auto flex gap-4">
            <button 
              onClick={toggleScan}
              className={`flex-1 py-4 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 ${isScanning ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-900/20' : 'bg-cyt-green hover:bg-green-600 text-white shadow-green-900/20'}`}
            >
              {isScanning ? (
                <>
                  <Square fill="currentColor" size={24} />
                  STOP
                </>
              ) : (
                <>
                  <Play fill="currentColor" size={24} />
                  START SCAN
                </>
              )}
            </button>
            
            <button 
              className="flex-none w-20 bg-slate-800 text-slate-300 rounded-2xl flex items-center justify-center border border-slate-700 active:bg-slate-700 active:scale-95 transition-all"
              onClick={handleTailAll}
              aria-label="Tail All"
            >
              <EyeOff size={28} />
            </button>
            
            <button 
              className="flex-none w-20 bg-slate-800 text-slate-300 rounded-2xl flex items-center justify-center border border-slate-700 active:bg-slate-700 active:scale-95 transition-all"
              onClick={() => setDevices([])}
              aria-label="Clear List"
            >
              <RefreshCw size={28} />
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
        settings={settings}
        onSave={setSettings}
        devices={devices}
      />

      <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />

    </div>
  );
};

export default App;
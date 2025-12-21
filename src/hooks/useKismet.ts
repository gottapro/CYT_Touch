import { useEffect, useRef } from 'react';
import useDeviceStore from '../stores/deviceStore';
import { Device, KismetDevice, GPSCoordinate } from '../types';
import { assessThreatLevel, KNOWN_THREAT_VENDORS } from '../utils/threatAssessment';

const KISMET_DATA_SOURCE = 'http://localhost:5000/devices';

// --- MAC Address Randomization & Stalker Logic ---

// Heuristics for matching a new device to an existing one whose MAC has likely changed.
const findPotentialAlias = (newDevice: Device, existingDevices: Device[]): Device | null => {
  if (newDevice.probedSSIDs.length < 2 && newDevice.vendor === 'Unknown') {
    return null; // Not enough data for a reliable match
  }

  for (const oldDevice of existingDevices) {
    // Basic checks
    if (oldDevice.mac === newDevice.mac || oldDevice.type !== newDevice.type) continue;

    // Time window: must have been seen recently
    if (Date.now() - oldDevice.lastSeen > 60000 * 5) continue; // 5 minutes

    let score = 0;
    const { rssi, probedSSIDs, vendor } = newDevice;

    // 1. Signal Strength similarity (strong indicator)
    if (Math.abs(rssi - oldDevice.rssi) < 10) {
      score += 35;
    }

    // 2. Probed SSIDs overlap (very strong indicator)
    if (probedSSIDs.length > 0 && oldDevice.probedSSIDs.length > 0) {
      const intersection = probedSSIDs.filter(p => oldDevice.probedSSIDs.includes(p));
      if (intersection.length >= 2) {
        score += 50;
      } else if (intersection.length > 0) {
        score += 25;
      }
    }

    // 3. Vendor consistency
    if (vendor !== 'Unknown' && vendor === oldDevice.vendor) {
      score += 15;
    }

    if (score >= 65) {
      console.log(`[ALIAS] Potential alias found for ${newDevice.mac} -> ${oldDevice.mac} (Score: ${score})`);
      return oldDevice;
    }
  }
  return null;
};

// Calculates distance between two GPS coordinates in meters
const calculateDistance = (pos1: GPSCoordinate, pos2: GPSCoordinate): number => {
    const R = 6371e3; // metres
    const φ1 = pos1.lat * Math.PI / 180;
    const φ2 = pos2.lat * Math.PI / 180;
    const Δφ = (pos2.lat - pos1.lat) * Math.PI / 180;
    const Δλ = (pos2.lng - pos1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};


// --- Main Hook ---
export const useKismet = () => {
  const { devices, setDevices, updateDevice, setError } = useDeviceStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const userLocationRef = useRef<GPSCoordinate | null>(null);

  // GPS watcher effect
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        userLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => { /* handle error */ },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const parseKismetData = (kismetDevice: KismetDevice): Device | null => {
    const mac = kismetDevice['kismet.device.base.macaddr'];
    if (!mac) return null;

    const signal = kismetDevice['kismet.device.base.signal'];
    const rssi = signal?.['kismet.common.signal.last_signal'] ?? -100;

    const name = kismetDevice['kismet.device.base.name'] || kismetDevice['kismet.device.base.commonname'] || '';
    const vendor = kismetDevice['kismet.device.base.manuf'] || 'Unknown';
    
    const phyName = kismetDevice['kismet.device.base.phyname'];
    const kismetType = kismetDevice['kismet.device.base.type'];
    let type: Device['type'] = 'Wi-Fi Client';
    if (phyName?.toLowerCase().includes('bluetooth')) type = 'Bluetooth';
    if (phyName?.toLowerCase().includes('ble')) type = 'BLE';
    if (kismetType === 'Wi-Fi AP') type = 'Wi-Fi AP';


    const dot11 = kismetDevice['dot11.device'];
    const probedSSIDs = dot11?.['dot11.device.probed_ssid_map']
      ?.map((p: any) => p['dot11.probedssid.ssid'])
      .filter(Boolean) ?? [];

    const firstSeen = kismetDevice['kismet.device.base.first_time'] * 1000;

    return {
      mac,
      name,
      vendor,
      rssi,
      type,
      probedSSIDs,
      firstSeen,
      lastSeen: kismetDevice['kismet.device.base.last_time'] * 1000,
      threatLevel: assessThreatLevel(vendor, name, rssi, type),
      isChasing: KNOWN_THREAT_VENDORS.some(v => vendor.toLowerCase().includes(v.toLowerCase())),
      isIgnored: false,
      notes: '',
    };
  };

  const processDeviceUpdates = (newReadings: KismetDevice[]) => {
    const now = Date.now();
    const currentDevices = useDeviceStore.getState().devices;
    const updatedDeviceMap = new Map(Object.entries(currentDevices));

    newReadings.forEach(kismetDevice => {
      const parsed = parseKismetData(kismetDevice);
      if (!parsed) return;

      const existing = updatedDeviceMap.get(parsed.mac);

      if (existing) {
        // Update existing device
        existing.lastSeen = now;
        existing.rssi = parsed.rssi;
        existing.probedSSIDs = [...new Set([...existing.probedSSIDs, ...parsed.probedSSIDs])];

        // Stalker Logic: Check for persistent devices that are following the user
        const persistenceDuration = (now - existing.firstSeen) / (1000 * 60); // in minutes
        if (
            !existing.isIgnored &&
            !existing.isChasing &&
            persistenceDuration > 15 && // seen for over 15 mins
            userLocationRef.current &&
            existing.firstSeenUserPos
        ) {
            const distance = calculateDistance(existing.firstSeenUserPos, userLocationRef.current);
            if (distance > 500) { // followed for over 500 meters
                existing.isChasing = true;
                existing.notes = `Auto-chased: Followed for ${(distance / 1000).toFixed(1)}km.`;
            }
        }
        updatedDeviceMap.set(existing.mac, existing);

      } else {
        // It's a new device, check for potential alias
        const alias = findPotentialAlias(parsed, Object.values(currentDevices));
        if (alias) {
          // It's an alias. Update the old device with new MAC and info.
          const oldDevice = updatedDeviceMap.get(alias.mac)!;
          
          // Create a new device object to avoid mutation issues
          const newAliasDevice = { ...oldDevice };
          newAliasDevice.notes = `MAC changed. Was ${alias.mac}.`;
          newAliasDevice.mac = parsed.mac;
          newAliasDevice.lastSeen = now;
          newAliasDevice.rssi = parsed.rssi;
          
          // Remove old, add new
          updatedDeviceMap.delete(alias.mac);
          updatedDeviceMap.set(parsed.mac, newAliasDevice);

        } else {
          // Truly a new device
          if (userLocationRef.current) {
            parsed.firstSeenUserPos = userLocationRef.current;
          }
          updatedDeviceMap.set(parsed.mac, parsed);
        }
      }
    });

    setDevices(Object.fromEntries(updatedDeviceMap));
  };


  const startScan = () => {
    if (eventSourceRef.current) return;
    
    const eventSource = new EventSource(KISMET_DATA_SOURCE);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[Kismet] Connection opened');
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Kismet might send a single object or an array
        const readings = Array.isArray(data) ? data : [data];
        if (readings.length > 0) {
          processDeviceUpdates(readings);
        }
      } catch (e) {
        console.error('Failed to parse Kismet data:', e);
      }
    };

    eventSource.onerror = () => {
      setError('Connection to backend failed. Is the bridge running?');
      eventSource.close();
      eventSourceRef.current = null;
    };
  };

  const stopScan = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log('[Kismet] Connection closed');
    }
  };

  return { startScan, stopScan };
};

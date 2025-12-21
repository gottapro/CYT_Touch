export enum ThreatLevel {
  UNKNOWN = 'UNKNOWN',
  SAFE = 'SAFE',
  SUSPICIOUS = 'SUSPICIOUS',
  HIGH = 'HIGH',
}

export const KNOWN_THREAT_VENDORS = [
  'Flipper Devices', 'Hak5', 'Pine64', 'Espressif', 
  'DJI Technology', 'Autel Robotics', 'Parrot', 'Yuneec',
  'ALFA Network', 'Ubiquiti', 'Shenzhen'
];

export const KNOWN_TRACKER_VENDORS = ['Tile', 'Apple'];

export const assessThreatLevel = (vendor: string = '', ssid: string = '', rssi: number, type: string): ThreatLevel => {
  const v = vendor.toLowerCase();
  
  if (KNOWN_THREAT_VENDORS.some(t => v.includes(t.toLowerCase()))) {
    return ThreatLevel.HIGH;
  }
  
  if (type === 'BLE' && KNOWN_TRACKER_VENDORS.some(t => v.includes(t.toLowerCase()))) {
     return ThreatLevel.SUSPICIOUS;
  }
  
  if (!ssid && rssi > -50) {
    return ThreatLevel.SUSPICIOUS;
  }
  
  return ThreatLevel.UNKNOWN;
};

export enum DeviceType {
  STATION = 'Station',
  AP = 'Access Point',
  DRONE = 'Drone/UAV',
  BLUETOOTH = 'Bluetooth',
  BLE = 'Bluetooth LE',
  UNKNOWN = 'Unknown'
}

export enum ThreatLevel {
  SAFE = 'Safe',
  UNKNOWN = 'Unknown',
  SUSPICIOUS = 'Suspicious',
  HIGH = 'High'
}

export interface GPSCoordinate {
  lat: number;
  lng: number;
}

export interface WifiDevice {
  mac: string;
  ssid?: string;
  rssi: number;
  firstSeen: number; // timestamp when device first appeared
  lastSeen: number; // timestamp of most recent packet
  vendor?: string;
  type: DeviceType;
  threatLevel: ThreatLevel;
  isIgnored: boolean; // "Tail" list
  isTracked: boolean; // "Chasing" list
  notes?: string;
  
  // Advanced Intelligence
  probedSSIDs: string[]; // List of networks this device is searching for
  gps?: GPSCoordinate;   // Last known GPS location
  gpsHistory: GPSCoordinate[]; // History of movement for tracking paths
  firstSeenUserPos?: GPSCoordinate; // User's location when device was FIRST seen
  persistenceScore: number; // 0.0 to 1.0 (or 0-100)
  timeWindow: 'recent' | 'medium' | 'old' | 'oldest';
  
  // Fingerprinting
  suspectedAlias?: string; // MAC address of the device this likely is (based on probe matching)
  pastMacs?: string[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'alert' | 'success';
}

export interface AnalysisResult {
  summary: string;
  threatScore: number;
  recommendation: string;
}

export interface AppSettings {
  isDemoMode: boolean;
  dataSourceUrl: string; // e.g., http://localhost:2501/devices.json
  refreshRate: number;
}
import { WifiDevice, AppSettings } from '../types';

interface CYTDatabase {
  devices: WifiDevice[];
  settings: AppSettings;
  sessions: Session[];
}

interface Session {
  id?: number;
  timestamp: number;
  deviceCount: number;
  duration: number;
  trackedDevices: string[]; // MAC addresses
}

class DatabaseService {
  private dbName = 'cyt-touch-db';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('devices')) {
          const deviceStore = db.createObjectStore('devices', { keyPath: 'mac' });
          deviceStore.createIndex('threatLevel', 'threatLevel', { unique: false });
          deviceStore.createIndex('isTracked', 'isTracked', { unique: false });
          deviceStore.createIndex('lastSeen', 'lastSeen', { unique: false });
        }

        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // ========== DEVICES ==========
  
  async saveDevices(devices: WifiDevice[]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['devices'], 'readwrite');
      const store = transaction.objectStore('devices');

      // Clear old data first
      store.clear();

      // Add all devices
      devices.forEach(device => {
        store.put(device);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async loadDevices(): Promise<WifiDevice[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['devices'], 'readonly');
      const store = transaction.objectStore('devices');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getTrackedDevices(): Promise<WifiDevice[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['devices'], 'readonly');
      const store = transaction.objectStore('devices');
      const index = store.index('isTracked');
      const request = index.getAll(true);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clearDevices(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['devices'], 'readwrite');
      const store = transaction.objectStore('devices');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ========== SESSIONS ==========

  async saveSession(devices: WifiDevice[], scanDuration: number): Promise<number> {
    if (!this.db) await this.init();

    const session: Session = {
      timestamp: Date.now(),
      deviceCount: devices.length,
      duration: scanDuration,
      trackedDevices: devices.filter(d => d.isTracked).map(d => d.mac)
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.add(session);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getSessions(limit: number = 10): Promise<Session[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result || [];
        // Return most recent sessions
        resolve(sessions.slice(-limit).reverse());
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ========== STATISTICS ==========

  async getStats(): Promise<{
    totalDevicesSeen: number;
    totalTracked: number;
    totalSessions: number;
    oldestSession: number | null;
  }> {
    if (!this.db) await this.init();

    const devices = await this.loadDevices();
    const sessions = await this.getSessions(1000);

    return {
      totalDevicesSeen: devices.length,
      totalTracked: devices.filter(d => d.isTracked).length,
      totalSessions: sessions.length,
      oldestSession: sessions.length > 0 ? sessions[sessions.length - 1].timestamp : null
    };
  }

  // ========== CLEANUP ==========

  async deleteOldSessions(daysToKeep: number = 30): Promise<void> {
    if (!this.db) await this.init();

    const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const session = cursor.value as Session;
          if (session.timestamp < cutoffDate) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Export singleton instance
export const db = new DatabaseService();
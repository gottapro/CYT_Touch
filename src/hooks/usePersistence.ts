import { useEffect } from 'react';
import { db } from '../services/dbService';
import useDeviceStore from '../stores/deviceStore';

export const usePersistence = () => {
  const { devices, setDevices } = useDeviceStore();

  // Initialize DB and load devices on mount
  useEffect(() => {
    const initAndLoad = async () => {
      try {
        await db.init();
        const savedDevices = await db.loadDevices();
        if (savedDevices && Object.keys(savedDevices).length > 0) {
          console.log(`[DB] Loaded ${Object.keys(savedDevices).length} devices.`);
          setDevices(savedDevices);
        }
      } catch (error) {
        console.error('[DB] Failed to initialize or load from database:', error);
      }
    };
    initAndLoad();
  }, [setDevices]);

  // Auto-save devices whenever they change (with debounce)
  useEffect(() => {
    if (Object.keys(devices).length === 0) return;

    const handler = setTimeout(() => {
      db.saveDevices(devices).catch(err => console.error('[DB] Auto-save failed:', err));
    }, 5000); // Debounce saves to every 5 seconds

    return () => {
      clearTimeout(handler);
    };
  }, [devices]);
};

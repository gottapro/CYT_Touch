import { useState, useEffect } from 'react';

const APP_SETTINGS_KEY = 'cyt_settings';

export interface AppSettings {
  isDemoMode: boolean;
  refreshRate: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  isDemoMode: false,
  refreshRate: 5000,
};

export const useSettings = (): [AppSettings, (newSettings: AppSettings) => void] => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(APP_SETTINGS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  return [settings, setSettings];
};

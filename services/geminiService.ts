import { WifiDevice, AnalysisResult } from '../types';

export const isConfigured = (): boolean => {
  // We can't synchronously check the backend here. 
  // Ideally, SettingsModal should fetch this status.
  // For now, returning false ensures the user sees the setup instructions if they are having trouble.
  // Or we could check import.meta.env.VITE_API_KEY as a hint, but the backend is what matters.
  return !!import.meta.env.VITE_API_KEY;
};

export const analyzeDeviceSignature = async (device: WifiDevice, baseUrl: string): Promise<AnalysisResult> => {
  try {
    // Construct the analysis endpoint from the base data URL
    // e.g., "http://192.168.1.50:5000/devices" -> "http://192.168.1.50:5000/analyze"
    const analyzeUrl = baseUrl.replace('/devices', '/analyze');

    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mac: device.mac,
        vendor: device.vendor,
        ssid: device.ssid,
        rssi: device.rssi,
        type: device.type,
        persistenceScore: device.persistenceScore,
        probedSSIDs: device.probedSSIDs
      })
    });

    if (!response.ok) {
      throw new Error(`Bridge returned ${response.status}`);
    }

    const result = await response.json();
    return result as AnalysisResult;

  } catch (error) {
    console.error("Analysis Error:", error);
    return {
      summary: "Analysis failed. Check bridge connection and API key configuration.",
      threatScore: 0,
      recommendation: "Check Logs"
    };
  }
};
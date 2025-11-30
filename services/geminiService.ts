import { GoogleGenAI, Type, Schema } from "@google/genai";
import { WifiDevice, AnalysisResult } from '../types';

export const isConfigured = (): boolean => {
  return !!import.meta.env.VITE_API_KEY;
};

export const analyzeDeviceSignature = async (device: WifiDevice): Promise<AnalysisResult> => {
  // The API key must be obtained exclusively from the environment variable import.meta.env.VITE_API_KEY.
  const apiKey = import.meta.env.VITE_API_KEY;
  
  if (!apiKey) {
    return {
      summary: "API Configuration Missing. Please set VITE_API_KEY in your environment variables (.env file).",
      threatScore: 0,
      recommendation: "Config Error"
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const prompt = `
      Analyze the following WiFi device signature for potential security threats in a residential or tactical monitoring context (Wardriving).
      
      Device Data:
      - MAC: ${device.mac}
      - Vendor: ${device.vendor || 'Unknown'}
      - SSID: ${device.ssid || 'Hidden/Probe'}
      - Signal (RSSI): ${device.rssi} dBm
      - Type: ${device.type}
      - Persistence: ${Math.round(device.persistenceScore * 100)}%
      
      Is this device likely a normal household device, a security camera, a drone, or a random passerby?
      Provide a brief summary, a threat score (0-100), and a recommendation (Ignore, Monitor, or Chase).
    `;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        threatScore: { type: Type.INTEGER },
        recommendation: { type: Type.STRING }
      },
      required: ["summary", "threatScore", "recommendation"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are a cybersecurity analyst expert in WiFi signal intelligence (SIGINT). Be concise."
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      summary: "Analysis failed due to network or API error.",
      threatScore: 0,
      recommendation: "Check Logs"
    };
  }
};
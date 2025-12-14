# CYT Touch - Project Context

## Project Overview
**CYT Touch** ("Chasing Your Tail") is a tactical Signals Intelligence (SIGINT) dashboard designed for the Raspberry Pi 5. It serves as a touch-optimized frontend for the **Kismet** wireless intrusion detection system.

**Core Mission:** Real-time visualization, behavioral profiling ("Stalker Logic"), and forensic tracking of Wi-Fi/Bluetooth devices.

## Architecture

The system follows a split architecture:

1.  **Frontend (React + Vite):**
    *   **Port:** 3000
    *   **Role:** User interface, state management, "Stalker Logic" heuristics, persistence, and visualization.
    *   **Persistence:** Uses `IndexedDB` (via `services/dbService.ts`) to save device history across sessions.
    *   **AI:** Direct integration with Google Gemini via `services/geminiService.ts` for threat profiling.

2.  **Backend Bridge (Python):**
    *   **File:** `cyt_bridge.py`
    *   **Port:** 5000
    *   **Role:** Acts as a proxy between the React frontend and the local Kismet instance (default port 2501).
    *   **Functions:** Handles CORS, filters Kismet JSON streams to reduce bandwidth, reads system stats (CPU temp), and proxies AI requests (server-side API key handling).

3.  **Data Source (Kismet):**
    *   Runs independently as a system service.
    *   Performs the actual radio frequency monitoring.

## Key Files & Directories

*   **`App.tsx`**: The heart of the application. Contains the main update loop, data parsing, state management (devices, filters, sorting), and UI layout.
*   **`cyt_bridge.py`**: The Python middleware. Crucial for connecting to Kismet and handling the AI API secure calls.
*   **`components/DeviceCard.tsx`**: The primary UI unit displaying device info, signal strength, and threat actions (Chase/Tail).
*   **`services/dbService.ts`**: Handles all local data persistence using IndexedDB.
*   **`start_cyt.sh`**: The master startup script that launches both the Python bridge and the Vite dev server.

## Setup & Running

**Prerequisites:**
*   Node.js v18+
*   Python 3.11+
*   Kismet (configured and running)

**Installation:**
```bash
npm install
# Ensure Kismet is running: sudo systemctl start kismet
```

**Configuration:**
Create a `.env` file for API keys:
```env
VITE_API_KEY=your_google_gemini_api_key
```

**Running:**
Use the helper script to start the full stack:
```bash
./start_cyt.sh
```
Or run components individually:
*   Bridge: `python3 cyt_bridge.py`
*   Frontend: `npm run dev -- --host`

## Development Conventions

*   **Styling:** TailwindCSS is used for all styling.
*   **Icons:** `lucide-react` is the standard icon library.
*   **Typing:** Strict TypeScript interfaces (see `types.ts`).
*   **Sorting:**
    *   `Activity` (lastSeen)
    *   `Signal` (rssi)
    *   `Age` (firstSeen - Newest)
*   **Threat Levels:**
    *   `High`: Known threat vendors (Flipper, Hak5).
    *   `Suspicious`: Hidden SSID with strong signal or "Chasing" behavior.
    *   `Safe`: Standard devices.

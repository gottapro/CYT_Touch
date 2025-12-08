# CYT Touch (v1.2.0)

**Tactical Signals Intelligence (SIGINT) Dashboard**

CYT Touch is a professional-grade, touch-optimized interface for real-time wireless surveillance. Designed for the **Raspberry Pi 5**, it sits on top of the Kismet wireless intrusion detection system to provide actionable intelligence, behavioral profiling, and forensic tracking of Wi-Fi and Bluetooth devices in the field.

---

## ⚡ Key Features

### 📡 Real-Time Monitoring
*   **Multi-Spectrum:** Detects **Wi-Fi Access Points**, **Clients**, **Bluetooth**, and **BLE** devices simultaneously.
*   **Visual Identification:** Instantly distinguishes between Infrastructure (Routers) and Clients (Phones/Laptops) with distinct iconography.
*   **High-Performance:** Streaming architecture handles 400+ active devices on a Raspberry Pi without lag.

### 🧠 Smart "Stalker" Logic
*   **Behavioral Tracking:** Automatically flags devices that persist near you for extended periods (>15 mins).
*   **Movement Correlation:** Elevates threats to **"Chasing"** status *only* if they follow you across significant distances (>500m), filtering out stationary neighbors.
*   **GPS History:** Records a breadcrumb trail of coordinates for every device to visualize its movement path relative to yours.

### 💾 Session Persistence & Statistics (New in v1.2)
*   **Auto-Save:** Continuously saves your device list to a local database (IndexedDB), ensuring you never lose tracking data if the browser refreshes or the Pi reboots.
*   **Session History:** Tracks scan duration and device counts across multiple sessions.
*   **Statistics Dashboard:** View total unique devices seen, tracking history, and session longevity.

### 🚨 Red Alert Proximity Warning
*   **Immediate Threat Detection:** Triggers a **full-screen, pulsing red overlay** when a known "High Threat" device (e.g., Flipper Zero, WiFi Pineapple) comes within close proximity (Signal > -65dBm).
*   **Haptic Feedback:** Vibrates mobile devices to alert you even if the screen is not in focus.
*   **Tactical Options:** One-tap "ENGAGE" button to immediately lock tracking on the target.

### 🔎 Advanced Filtering & Sorting (New in v1.2)
*   **Deep Search:** Instantly find devices by MAC, Vendor, SSID, or even *Probed Networks*.
*   **Tail All:** One-tap "Stealth Mode" to ignore all currently visible non-threats, clearing the deck to focus on new arrivals.
*   **Dynamic Sort:** Cycle through sorting by **Time (Activity)**, **Signal Strength (RSSI)**, or **Newest (Discovery)** to prioritize your view.

### 🤖 AI-Powered Analysis
*   **Deep Profiling:** Integrates **Google Gemini AI** to analyze device signatures.
*   **Probe Analysis:** Feeds the AI a list of **Probed SSIDs** (networks a device is searching for) to detect "Home Base" networks, corporate affiliations, or aggressive surveillance tools.

### 🗺️ Forensic Export & Visualization
*   **Spectacular KML:** Exports to Google Earth with:
    *   **Tracking Paths:** `<LineString>` visualization connecting historical GPS points.
    *   **Rich Balloons:** HTML popups showing full device details and probe lists.
    *   **Threat Coloring:** Red/Magenta/Green coding based on threat level.
*   **Surveillance Reports:** Generates professional **Markdown** summaries of all tracked targets for documentation.

---

## 🛠️ Prerequisites

### Hardware
*   **Raspberry Pi 4 or 5** (Recommended).
*   **Touchscreen** (7" recommended) or Mobile Device (via browser).
*   **Wi-Fi Adapter** supporting Monitor Mode.
*   **GPS Module** (USB/Serial) - Optional but required for tracking logic.

### Software
*   **OS:** Raspberry Pi OS (Bookworm/Bullseye) or Kali Linux.
*   **Core:** Kismet, Python 3.11+, Node.js v18+.
*   **API:** Google Cloud API Key (for Gemini AI features).

---

## 🚀 Installation

1.  **System Setup**
    ```bash
    sudo apt update && sudo apt install -y kismet python3 python3-pip nodejs npm
    # Ensure Kismet is configured and running
    sudo systemctl enable --now kismet
    ```
    
    **Note:** For the **"Purge Kismet DB"** feature to work, the user running the app must be able to run `sudo systemctl` commands without a password. 
    To configure this:
    ```bash
    sudo visudo
    # Add the following line at the end (replace 'pi' with your username):
    pi ALL=(ALL) NOPASSWD: /usr/bin/systemctl start kismet, /usr/bin/systemctl stop kismet
    ```

2.  **Clone Repository**
    ```bash
    git clone https://github.com/gottapro/CYT_Touch.git
    cd CYT_Touch
    ```

3.  **Install Dependencies**
    ```bash
    npm install
    ```

4.  **Configuration**
    Create a `.env` file in the root directory for AI features:
    ```bash
    echo "VITE_API_KEY=your_google_gemini_api_key" > .env
    ```

---

## 🎮 Operational Usage

### 1. Start the System
Use the included launcher script to start the Python Bridge (Port 5000) and Web UI (Port 3000):
```bash
./start_cyt.sh
```
*Access the dashboard at `http://<PI_IP>:3000` on your phone or tablet.*

### 2. The Workflow ("The Hunt")
1.  **Sanitize:** Tap **Tail All** (Shield Icon) to ignore current safe traffic, or tap **TAIL** on individual devices.
2.  **Scan:** Watch the **"Nearby"** list. Devices probing for networks will reveal their intentions.
3.  **Sort & Search:** Use the new **Sort** button to cycle through display orders (Time, Signal, Newest) and the search bar to filter by MAC, Vendor, SSID, or Probes.
4.  **Red Alert!** If a **High Threat** device comes into close proximity (-65dBm), a full-screen Red Alert will trigger. Respond by Tapping "ENGAGE" to track or "DISMISS".
5.  **Move:** As you travel, the **Smart Logic** will monitor for persistent signals.
    *   **Yellow Border:** Device is lingering (>15 mins).
    *   **Red Border/Eye Icon:** Device is **Chasing** (lingering + moving >500m with you).
6.  **Analyze:** Tap the **Activity Pulse** icon on a suspicious device to run an AI threat assessment.
7.  **Review Stats:** Check the **Database** icon to see session longevity and total tracked devices.
8.  **Export:** 
    *   Go to **Settings**.
    *   Tap **Download KML Map** for Google Earth analysis.
    *   Tap **Report (MD)** for a text summary.
9.  **Reset:**
    *   Use **Purge Kismet DB** in Settings to wipe the underlying database and restart the Kismet service. This is recommended when moving to a completely new physical location to ensure your "Stalker Logic" starts fresh.

---

## 📂 Architecture

*   **Frontend:** React + Vite + TailwindCSS (Touch-Optimized).
*   **Backend:** Python Bridge (`cyt_bridge.py`) - Proxies Kismet API, filters fields, streams JSON.
*   **Persistence:** IndexedDB (Client-side storage).
*   **Data Source:** Kismet (local instance).

### Performance Tuning
*   **Refresh Rate:** Defaults to **8000ms** (8s) for stability.
*   **Timeouts:** 25s grace period for large Kismet payloads.

---

## ⚠️ Legal Disclaimer
*This tool is for educational and defensive security research purposes only. Users are responsible for complying with all local, state, and federal laws regarding radio surveillance and privacy.*
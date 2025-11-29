# CYT Touch - The Hunter's Dashboard

A touch-optimized graphical interface for Chasing Your Tail NG, designed for Raspberry Pi 5 + 7" Touchscreen.

## 🚀 Installation on Raspberry Pi

### Prerequisites
You need a Raspberry Pi running Raspberry Pi OS (Lite or Desktop).

1. **Install System Tools:**
   ```bash
   sudo apt update
   sudo apt install nodejs npm python3 kismet -y
   ```

2. **Clone & Install:**
   ```bash
   # Clone your repo (replace URL with your actual repo)
   git clone https://github.com/YourUsername/CYT-Touch.git
   cd CYT-Touch

   # Install Javascript dependencies
   npm install
   ```

3. **Configure API Key (Optional but Recommended):**
   Create a `.env` file for AI analysis:
   ```bash
   echo "API_KEY=your_google_api_key_here" > .env
   ```

## 🎮 How to Run

**The Easy Way:**
Run the included launcher script. It handles the Python backend and the Frontend automatically.

```bash
chmod +x start_cyt.sh
./start_cyt.sh
```

**The Manual Way:**
1. Terminal 1: `python3 cyt_bridge.py`
2. Terminal 2: `npm run dev`

Then open Chromium on the Pi and go to: `http://localhost:3000`

## ⚙️ Configuration

### Connecting to Kismet
1. Ensure Kismet is running: `sudo systemctl start kismet`
2. In the App, go to **Settings**.
3. Set Mode to **Live Mode**.
4. Set Data URL to: `http://localhost:5000/devices`

### Wigle.net
To use the "Probe Hunter" feature:
1. Log in to [Wigle.net](https://wigle.net) in your browser.
2. The app will open direct links to search device SSIDs.

## 🛡️ The Workflow

1. **Establish Baseline:** Tap **TAIL** (Shield) on all known devices (Home WiFi, Phone).
2. **The Hunt:** Watch for new devices.
3. **Red Alert:** If a Drone or Hacker Tool appears nearby, the screen turns RED.
4. **Analysis:** Tap the **Heartbeat Icon** to use AI to identify unknown signals.
5. **Clean Up:** Tap Settings -> **Purge Kismet DB** when moving to a new location.

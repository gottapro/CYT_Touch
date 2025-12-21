import os
import sys
import json
import asyncio
import aiohttp
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
GEMINI_API_KEY = os.getenv('VITE_API_KEY')
KISMET_API_KEY = os.getenv('KISMET_API_KEY')
KISMET_URL = os.getenv('KISMET_URL', 'http://localhost:2501')
PORT = int(os.getenv('PORT', 5000))
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')

# --- FastAPI App Initialization ---
app = FastAPI(
    title="CYT Touch Bridge",
    description="A proxy server to connect the CYT Touch frontend with Kismet and AI services.",
    version="2.0.0"
)

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Reusable HTTP Client Session ---
@app.on_event("startup")
async def startup_event():
    app.state.http_session = aiohttp.ClientSession()

@app.on_event("shutdown")
async def shutdown_event():
    await app.state.http_session.close()

# --- Helper Functions ---
def get_cpu_temp():
    """Read the Raspberry Pi CPU temperature."""
    if sys.platform != "linux":
        return 0.0
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            temp_str = f.read().strip()
            return float(temp_str) / 1000.0
    except Exception:
        return 0.0

async def analyze_device_with_gemini(device_data: dict):
    """Asynchronously call the Gemini API."""
    if not GEMINI_API_KEY:
        return {
            'summary': 'API Key not configured on server',
            'threatScore': 0,
            'recommendation': 'Config Error'
        }

    prompt = f"""Analyze this WiFi/Bluetooth device for security threats based on the data below.

**Device Data:**
- **MAC Address:** {device_data.get('mac', 'N/A')}
- **Vendor:** {device_data.get('vendor', 'Unknown')}
- **Advertised Name/SSID:** {device_data.get('ssid', 'Hidden')}
- **Signal Strength:** {device_data.get('rssi', -90)} dBm
- **Device Type:** {device_data.get('type', 'Unknown')}
- **Probed SSIDs:** {', '.join(device_data.get('probedSSIDs', []))}

**Your Task:**
Provide a concise security analysis. Your response MUST be a single, clean JSON object with no extra formatting, markdown, or text.

**JSON Structure:**
{{
  "summary": "Your brief, one-sentence analysis here.",
  "threatScore": <integer between 0 and 100>,
  "recommendation": "A short, actionable recommendation (e.g., 'Monitor', 'Investigate', 'Benign')."
}}
"""

    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'temperature': 0.7, 'maxOutputTokens': 500}
    }
    
    api_url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}'

    try:
        async with app.state.http_session.post(api_url, json=payload, timeout=15) as response:
            if response.status != 200:
                error_text = await response.text()
                return {
                    'summary': f'Gemini API Error: {response.status}',
                    'threatScore': 0,
                    'recommendation': 'API Error'
                }
            
            result = await response.json()
            
            text_content = result['candidates'][0]['content']['parts'][0]['text']
            # Clean the response to get only the JSON
            json_text = text_content.strip().replace('```json', '').replace('```', '').strip()
            
            return json.loads(json_text)
            
    except Exception as e:
        return {
            'summary': f'Server error during analysis: {str(e)}',
            'threatScore': 0,
            'recommendation': 'Error'
        }

# --- API Endpoints ---
@app.get("/system")
async def get_system_stats():
    """Returns system health statistics like CPU temperature."""
    return JSONResponse(content={
        'cpu_temp': get_cpu_temp(),
        'status': 'online',
        'backend': 'kismet'
    })

@app.get("/devices")
async def stream_kismet_devices():
    """Streams device data from the Kismet server."""
    fields = [
        "kismet.device.base.macaddr", "kismet.device.base.name",
        "kismet.device.base.commonname", "kismet.device.base.manuf",
        "kismet.device.base.signal", "kismet.device.base.location",
        "kismet.device.base.first_time", "kismet.device.base.last_time",
        "kismet.device.base.phyname", "kismet.device.base.type",
        "dot11.device", "bluetooth.device", "ble.device"
    ]
    url = f"{KISMET_URL}/devices/views/all/devices.json?fields={','.join(fields)}"
    headers = {}
    if KISMET_API_KEY:
        headers['Cookie'] = f"KISMET={KISMET_API_KEY}"

    try:
        async def device_streamer():
            async with app.state.http_session.get(url, headers=headers, timeout=30) as response:
                if response.status != 200:
                    yield json.dumps({
                        'error': 'Could not connect to Kismet',
                        'details': f'Status: {response.status}',
                        'suggestion': 'Ensure Kismet is running and the API key (if any) is correct.'
                    }).encode()
                    return

                async for chunk in response.content.iter_chunked(8192):
                    yield chunk
        
        return StreamingResponse(device_streamer(), media_type="application/json")

    except aiohttp.ClientConnectorError as e:
        raise HTTPException(status_code=502, detail=f"Kismet connection failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {e}")

@app.post("/analyze")
async def analyze_device(request: Request):
    """Receives device data and returns a Gemini-based security analysis."""
    try:
        device_data = await request.json()
        result = await analyze_device_with_gemini(device_data)
        return JSONResponse(content=result)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON data.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze device: {e}")

@app.post("/purge")
async def purge_kismet_data():
    """Executes the Kismet data cleaning script."""
    script_path = "./clean_kismet.sh"
    if not os.path.exists(script_path):
        raise HTTPException(status_code=404, detail="clean_kismet.sh script not found.")
    
    try:
        # Make the script executable
        os.chmod(script_path, 0o755)
        
        # Run the script
        process = await asyncio.create_subprocess_shell(script_path)
        await process.wait()
        
        if process.returncode == 0:
            return JSONResponse(content={'status': 'executed', 'message': 'Purge command completed successfully.'})
        else:
            raise HTTPException(status_code=500, detail="Purge script failed to execute.")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute purge script: {e}")

# --- Main Execution ---
if __name__ == "__main__":
    print("--- CYT Bridge Server (v2.0) ---")
    print(f"INFO:     Allowed Origins: {ALLOWED_ORIGINS}")
    print(f"INFO:     Kismet URL: {KISMET_URL}")
    print(f"INFO:     Starting server on port {PORT}")
    print("------------------------------------")
    uvicorn.run(app, host="0.0.0.0", port=PORT)

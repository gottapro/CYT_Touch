import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os
import sys
import traceback

# Load API key from environment or file
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY and os.path.exists('.env'):
    with open('.env') as f:
        for line in f:
            if line.startswith('VITE_API_KEY='):
                GEMINI_API_KEY = line.split('=', 1)[1].strip()
                break

def analyze_device_with_gemini(device_data):
    """Call Gemini API server-side"""
    if not GEMINI_API_KEY:
        return {
            'summary': 'API Key not configured on server',
            'threatScore': 0,
            'recommendation': 'Config Error'
        }
    
    try:
        import urllib.request
        import json
        
        # Construct prompt
        prompt = f"""
Analyze the following WiFi device signature for potential security threats.

Device Data:
- MAC: {device_data.get('mac')}
- Vendor: {device_data.get('vendor', 'Unknown')}
- SSID: {device_data.get('ssid', 'Hidden/Probe')}
- Signal (RSSI): {device_data.get('rssi')} dBm
- Type: {device_data.get('type')}
- Persistence: {device_data.get('persistenceScore', 0) * 100}%
- Probed SSIDs: {', '.join(device_data.get('probedSSIDs', [])) or 'None'}

Provide:
1. Brief summary
2. Threat score (0-100)
3. Recommendation (Ignore, Monitor, or Chase)

Respond ONLY with valid JSON in this format:
{{"summary": "...", "threatScore": 0, "recommendation": "..."}}
"""
        
        # Call Gemini API
        url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
        headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
        }
        
        payload = {
            'contents': [{
                'parts': [{'text': prompt}]
            }],
            'generationConfig': {
                'temperature': 0.7,
                'maxOutputTokens': 500
            }
        }
        
        req = urllib.request.Request(
            f"{url}?key={GEMINI_API_KEY}",
            data=json.dumps(payload).encode(),
            headers=headers,
            method='POST'
        )
        
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read())
            text = result['candidates'][0]['content']['parts'][0]['text']
            
            # Extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            
            return {
                'summary': text[:200],
                'threatScore': 50,
                'recommendation': 'Monitor'
            }
            
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return {
            'summary': f'Analysis failed: {str(e)}',
            'threatScore': 0,
            'recommendation': 'Error'
        }

# Configuration
PORT = 5000
KISMET_URL = "http://localhost:2501"

class CytBridgeHandler(http.server.SimpleHTTPRequestHandler):
    """
    A Bridge Server to proxy requests from the React Web App to Kismet.
    This solves the CORS (Cross-Origin) security blocks browsers enforce.
    """
    def _set_headers(self, content_type='application/json'):
        self.send_header('Content-type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')  # Allow the Web App to connect
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        """Handle preflight CORS checks."""
        self.send_response(200)
        self._set_headers()

    def get_cpu_temp(self):
        """Read the Raspberry Pi CPU temperature."""
        if sys.platform != "linux":
            return 0.0
        try:
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                temp_str = f.read().strip()
                # Value is in millidegrees, convert to Celsius
                return float(temp_str) / 1000.0
        except:
            return 0.0

    def do_GET(self):
        """Handle GET requests for data."""
        # Endpoint: System Health (CPU Temp)
        if self.path == '/system':
            try:
                self.send_response(200)
                self._set_headers()
                stats = {
                    'cpu_temp': self.get_cpu_temp(),
                    'status': 'online',
                    'backend': 'kismet'
                }
                self.wfile.write(json.dumps(stats).encode())
            except (BrokenPipeError, ConnectionResetError):
                pass
            return

        # Endpoint: Device Data (Proxy to Kismet)
        if self.path == '/devices':
            try:
                # 1. Get API Key (if exists)
                api_key = ""
                if os.path.exists("kismet_api_key.txt"):
                    with open("kismet_api_key.txt", "r") as f:
                        api_key = f.read().strip()

                # 2. Connect to Kismet
                # OPTIMIZATION: Request only the fields we need to reduce payload size significantly.
                # CRITICAL FIX: Added dot11.device to get probed SSIDs
                base_url = f"{KISMET_URL}/devices/views/all/devices.json"
                fields = [
                    "kismet.device.base.macaddr",
                    "kismet.device.base.name",
                    "kismet.device.base.commonname",
                    "kismet.device.base.manuf",
                    "kismet.device.base.signal",
                    "kismet.device.base.location",
                    "kismet.device.base.first_time",
                    "kismet.device.base.last_time",
                    "kismet.device.base.phyname",
                    "kismet.device.base.type",
                    "dot11.device"  # THIS IS THE FIX - contains probed_ssid_map
                ]

                # Join fields with comma
                field_param = ",".join(fields)

                # Construct final URL
                url = f"{base_url}?fields={field_param}"
                print(f"Fetching: {url}")  # Debug log

                req = urllib.request.Request(url)
                if api_key:
                    req.add_header('Cookie', f"KISMET={api_key}")

                # 3. Fetch & Stream Data
                with urllib.request.urlopen(req, timeout=25) as response:
                    self.send_response(200)
                    self._set_headers()
                    # Stream the data in chunks to avoid loading the entire 50MB+ JSON into RAM
                    while True:
                        chunk = response.read(8192)  # 8KB chunks
                        if not chunk:
                            break
                        self.wfile.write(chunk)

            except (BrokenPipeError, ConnectionResetError):
                pass
            except urllib.error.URLError as e:
                # Kismet is probably not running
                print(f"Error connecting to Kismet: {e}")
                try:
                    self.send_response(502)
                    self._set_headers()
                    error_msg = {
                        'error': 'Could not connect to Kismet',
                        'details': str(e),
                        'suggestion': 'Ensure Kismet is running (systemctl start kismet)'
                    }
                    self.wfile.write(json.dumps(error_msg).encode())
                except:
                    pass
            except Exception as e:
                # Log the full error to the console so we know what went wrong
                print(f"INTERNAL ERROR in /devices: {e}")
                traceback.print_exc()
                try:
                    self.send_response(500)
                    self._set_headers()
                    self.wfile.write(json.dumps({'error': str(e)}).encode())
                except:
                    pass
            return

        # Default: Not Found
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        """Handle POST requests for commands."""
        
        # NEW: AI Analysis Endpoint
        if self.path == '/analyze':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                device_data = json.loads(post_data)
                
                print(f"Analyzing device: {device_data.get('mac')}")
                result = analyze_device_with_gemini(device_data)
                
                self.send_response(200)
                self._set_headers()
                self.wfile.write(json.dumps(result).encode())
            except Exception as e:
                print(f"Analysis Error: {e}")
                self.send_response(500)
                self._set_headers()
                self.wfile.write(json.dumps({
                    'summary': 'Server error',
                    'threatScore': 0,
                    'recommendation': 'Error'
                }).encode())
            return
    
        # Endpoint: Purge/Reset
        if self.path == '/purge':
            print("Command received: Purge Kismet Data")
            # NOTE: Actual purging requires system permissions or Kismet API calls.
            # For now, we return success to the UI.
            
            try:
                # Make script executable and run it
                os.system("chmod +x ./clean_kismet.sh")
                os.system("./clean_kismet.sh")
                
                self.send_response(200)
                self._set_headers()
                self.wfile.write(json.dumps({'status': 'executed', 'message': 'Purge command received'}).encode())
            except (BrokenPipeError, ConnectionResetError):
                pass
            return

        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    # Allow the port to be reused immediately after restart
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), CytBridgeHandler) as httpd:
        print("------------------------------------------------")
        print(f" CYT Bridge Server Running on Port {PORT}")
        print(f" Target Kismet URL: {KISMET_URL}")
        print("------------------------------------------------")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping Bridge Server.")
            sys.exit(0)
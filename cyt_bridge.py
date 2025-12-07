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
    """Call Gemini API with detailed Unicode debugging"""
    print(f"\n{'='*60}")
    print(f"[DEBUG] Starting analysis for device: {device_data.get('mac')}")
    
    if not GEMINI_API_KEY:
        print("[ERROR] No API key found!")
        return {
            'summary': 'API Key not configured on server',
            'threatScore': 0,
            'recommendation': 'Config Error'
        }
    
    print(f"[DEBUG] API Key present: {GEMINI_API_KEY[:8]}...")
    
    try:
        # Construct prompt with extensive Unicode safety
        print("[DEBUG] Processing device data fields...")
        
        probed_ssids = device_data.get('probedSSIDs', [])
        print(f"[DEBUG] Raw probedSSIDs: {probed_ssids}")
        
        # Safely process each field
        try:
            mac = str(device_data.get('mac', 'Unknown'))
            print(f"[DEBUG] MAC (raw): {repr(mac)}")
            mac = mac.encode('ascii', 'ignore').decode('ascii') or 'Unknown'
            print(f"[DEBUG] MAC (safe): {mac}")
        except Exception as e:
            print(f"[ERROR] MAC encoding failed: {e}")
            mac = 'Unknown'
        
        try:
            vendor = str(device_data.get('vendor', 'Unknown'))
            print(f"[DEBUG] Vendor (raw): {repr(vendor)}")
            vendor = vendor.encode('ascii', 'ignore').decode('ascii') or 'Unknown'
            print(f"[DEBUG] Vendor (safe): {vendor}")
        except Exception as e:
            print(f"[ERROR] Vendor encoding failed: {e}")
            vendor = 'Unknown'
        
        try:
            ssid = str(device_data.get('ssid', 'Hidden'))
            print(f"[DEBUG] SSID (raw): {repr(ssid)}")
            ssid = ssid.encode('ascii', 'ignore').decode('ascii') or 'Hidden'
            print(f"[DEBUG] SSID (safe): {ssid}")
        except Exception as e:
            print(f"[ERROR] SSID encoding failed: {e}")
            ssid = 'Hidden'
        
        try:
            device_type = str(device_data.get('type', 'Unknown'))
            print(f"[DEBUG] Type (raw): {repr(device_type)}")
            device_type = device_type.encode('ascii', 'ignore').decode('ascii') or 'Unknown'
            print(f"[DEBUG] Type (safe): {device_type}")
        except Exception as e:
            print(f"[ERROR] Type encoding failed: {e}")
            device_type = 'Unknown'
        
        try:
            probed_safe = []
            for ssid in probed_ssids:
                safe = str(ssid).encode('ascii', 'ignore').decode('ascii')
                if safe:
                    probed_safe.append(safe)
            probed_str = ', '.join(probed_safe) if probed_safe else 'None'
            print(f"[DEBUG] Probed SSIDs (safe): {probed_str}")
        except Exception as e:
            print(f"[ERROR] Probed SSIDs encoding failed: {e}")
            probed_str = 'None'
        
        print("[DEBUG] All fields processed successfully")
        
        # Build prompt
        prompt = f"""Analyze this WiFi device for security threats:

MAC: {mac}
Vendor: {vendor}
SSID: {ssid}
Signal: {device_data.get('rssi', -90)} dBm
Type: {device_type}
Persistence: {int(device_data.get('persistenceScore', 0) * 100)}%
Probed SSIDs: {probed_str}

Provide a brief security analysis. Respond with JSON only:
{{"summary": "brief analysis", "threatScore": 0, "recommendation": "Ignore"}}"""
        
        print(f"[DEBUG] Prompt created ({len(prompt)} chars)")
        print(f"[DEBUG] Prompt preview: {prompt[:100]}...")
        
        # Try API endpoints
        api_endpoints = [
            ('v1beta', 'gemini-2.0-flash-exp'),
            ('v1', 'gemini-1.5-flash'),
            ('v1beta', 'gemini-1.5-flash'),
            ('v1', 'gemini-pro'),
        ]
        
        payload = {
            'contents': [{
                'parts': [{'text': prompt}]
            }],
            'generationConfig': {
                'temperature': 0.7,
                'maxOutputTokens': 500
            }
        }
        
        print("[DEBUG] Payload structure created")
        
        for api_version, model in api_endpoints:
            try:
                url = f'https://generativelanguage.googleapis.com/{api_version}/models/{model}:generateContent'
                print(f"\n[DEBUG] Trying: {api_version}/{model}")
                
                # Serialize payload
                try:
                    payload_json = json.dumps(payload)
                    print(f"[DEBUG] Payload serialized ({len(payload_json)} bytes)")
                except Exception as e:
                    print(f"[ERROR] JSON serialization failed: {e}")
                    continue
                
                # Encode to bytes
                try:
                    payload_bytes = payload_json.encode('utf-8')
                    print(f"[DEBUG] Payload encoded to UTF-8")
                except Exception as e:
                    print(f"[ERROR] UTF-8 encoding failed: {e}")
                    print(f"[ERROR] This is the Unicode issue!")
                    print(f"[ERROR] Problematic JSON: {payload_json[:200]}")
                    continue
                
                # Make request
                req = urllib.request.Request(
                    f"{url}?key={GEMINI_API_KEY}",
                    data=payload_bytes,
                    headers={'Content-Type': 'application/json; charset=utf-8'},
                    method='POST'
                )
                
                print(f"[DEBUG] Request created, sending...")
                
                with urllib.request.urlopen(req, timeout=15) as response:
                    response_text = response.read().decode('utf-8')
                    print(f"[DEBUG] ✓ Success with {model}")
                    
                    result = json.loads(response_text)
                    
                    # Parse response
                    if 'candidates' not in result or len(result['candidates']) == 0:
                        print(f"[WARN] No candidates, trying next")
                        continue
                    
                    candidate = result['candidates'][0]
                    
                    if 'content' not in candidate:
                        print(f"[WARN] No content, trying next")
                        continue
                    
                    content = candidate['content']
                    
                    if 'parts' not in content or len(content['parts']) == 0:
                        print(f"[WARN] No parts, trying next")
                        continue
                    
                    text = content['parts'][0].get('text', '')
                    print(f"[DEBUG] Response text: {text[:100]}...")
                    
                    # Clean and parse
                    import re
                    text = text.strip()
                    text = re.sub(r'^```json\s*', '', text)
                    text = re.sub(r'^```\s*', '', text)
                    text = re.sub(r'\s*```$', '', text)
                    text = text.strip()
                    
                    try:
                        parsed = json.loads(text)
                        result = {
                            'summary': str(parsed.get('summary', 'Analysis completed'))[:500],
                            'threatScore': int(parsed.get('threatScore', 50)),
                            'recommendation': str(parsed.get('recommendation', 'Monitor'))
                        }
                        print(f"[DEBUG] ✓ Success! Returning result")
                        print(f"{'='*60}\n")
                        return result
                    except json.JSONDecodeError:
                        return {
                            'summary': text[:200] if text else 'No text',
                            'threatScore': 50,
                            'recommendation': 'Monitor'
                        }
            
            except urllib.error.HTTPError as e:
                print(f"[WARN] HTTP {e.code} for {model}")
                if e.code == 429:
                    return {
                        'summary': 'Rate limit exceeded (wait 60s)',
                        'threatScore': 0,
                        'recommendation': 'Wait'
                    }
                continue
            
            except UnicodeEncodeError as ue:
                print(f"[ERROR] UnicodeEncodeError for {model}: {ue}")
                print(f"[ERROR] Character position: {ue.start}-{ue.end}")
                print(f"[ERROR] Object: {repr(ue.object[max(0, ue.start-20):ue.end+20])}")
                continue
            
            except Exception as e:
                print(f"[ERROR] {type(e).__name__} for {model}: {str(e)}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"[ERROR] All endpoints failed")
        return {
            'summary': 'All API endpoints failed',
            'threatScore': 0,
            'recommendation': 'Error'
        }
    
    except Exception as e:
        print(f"[ERROR] Top-level error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'summary': f'Error: {type(e).__name__}',
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
        
        # AI Analysis Endpoint
        if self.path == '/analyze':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                device_data = json.loads(post_data)
                
                print(f"[INFO] Analyzing device: {device_data.get('mac')}")
                result = analyze_device_with_gemini(device_data)
                
                self.send_response(200)
                self._set_headers()
                self.wfile.write(json.dumps(result).encode())
            except Exception as e:
                print(f"[ERROR] Analysis endpoint error: {e}")
                import traceback
                traceback.print_exc()
                
                try:
                    self.send_response(500)
                    self._set_headers()
                    self.wfile.write(json.dumps({
                        'summary': f'Server error: {str(e)}',
                        'threatScore': 0,
                        'recommendation': 'Error'
                    }).encode())
                except:
                    pass
            return
        
        # Endpoint: Purge/Reset
        if self.path == '/purge':
            print("Command received: Purge Kismet Data")
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
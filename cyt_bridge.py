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
    """Call Gemini API server-side with correct model name"""
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
        # Construct prompt
        probed_ssids = device_data.get('probedSSIDs', [])
        probed_str = ', '.join(probed_ssids) if probed_ssids else 'None'
        
        prompt = f"""Analyze this WiFi device for security threats:

MAC: {device_data.get('mac', 'Unknown')}
Vendor: {device_data.get('vendor', 'Unknown')}
SSID: {device_data.get('ssid', 'Hidden/Probe')}
Signal: {device_data.get('rssi', -90)} dBm
Type: {device_data.get('type', 'Unknown')}
Persistence: {int(device_data.get('persistenceScore', 0) * 100)}%
Probed SSIDs: {probed_str}

Provide a brief security analysis. Respond with JSON only (no markdown):
{{"summary": "brief analysis", "threatScore": 0, "recommendation": "Ignore"}}"""
        
        print(f"[DEBUG] Prompt created")
        
        # FIXED: Use correct model name for v1beta API
        # Available models: gemini-1.5-pro, gemini-1.5-flash-latest, gemini-pro
        url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent'
        
        payload = {
            'contents': [{
                'parts': [{'text': prompt}]
            }],
            'generationConfig': {
                'temperature': 0.7,
                'maxOutputTokens': 500
            }
        }
        
        print(f"[DEBUG] Calling API: {url}")
        
        req = urllib.request.Request(
            f"{url}?key={GEMINI_API_KEY}",
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        with urllib.request.urlopen(req, timeout=15) as response:
            response_text = response.read().decode('utf-8')
            print(f"[DEBUG] Response received ({len(response_text)} bytes)")
            
            result = json.loads(response_text)
            
            # Navigate the response structure safely
            if 'candidates' not in result or len(result['candidates']) == 0:
                print(f"[ERROR] No candidates in response")
                return {
                    'summary': 'API returned no response',
                    'threatScore': 0,
                    'recommendation': 'Error'
                }
            
            candidate = result['candidates'][0]
            
            # Check for content blocking
            if 'content' not in candidate:
                # Check if it was blocked
                if 'finishReason' in candidate:
                    reason = candidate['finishReason']
                    print(f"[WARN] Response blocked: {reason}")
                    return {
                        'summary': f'Response blocked by safety filters: {reason}',
                        'threatScore': 0,
                        'recommendation': 'Unable to analyze'
                    }
                print(f"[ERROR] No content in candidate")
                return {
                    'summary': 'API candidate has no content',
                    'threatScore': 0,
                    'recommendation': 'Error'
                }
            
            content = candidate['content']
            
            if 'parts' not in content or len(content['parts']) == 0:
                print(f"[ERROR] No parts in content")
                return {
                    'summary': 'API content has no parts',
                    'threatScore': 0,
                    'recommendation': 'Error'
                }
            
            text = content['parts'][0].get('text', '')
            print(f"[DEBUG] Text received: {text[:200]}...")
            
            # Clean up the response
            import re
            text = text.strip()
            text = re.sub(r'^```json\s*', '', text)
            text = re.sub(r'^```\s*', '', text)
            text = re.sub(r'\s*```$', '', text)
            text = text.strip()
            
            # Parse JSON
            try:
                parsed = json.loads(text)
                print(f"[DEBUG] Successfully parsed JSON")
                
                # Ensure all required keys exist with defaults
                result = {
                    'summary': str(parsed.get('summary', 'Analysis completed'))[:500],
                    'threatScore': int(parsed.get('threatScore', 50)),
                    'recommendation': str(parsed.get('recommendation', 'Monitor'))
                }
                
                print(f"[DEBUG] Returning: {result}")
                print(f"{'='*60}\n")
                return result
                
            except json.JSONDecodeError:
                print(f"[WARN] Could not parse JSON, using text as summary")
                # Try to extract JSON with regex
                json_match = re.search(r'\{[^{}]*"summary"[^{}]*\}', text)
                if json_match:
                    try:
                        return json.loads(json_match.group())
                    except:
                        pass
                
                # Fallback: use the text
                return {
                    'summary': text[:200] if text else 'No analysis text',
                    'threatScore': 50,
                    'recommendation': 'Monitor'
                }
    
    except urllib.error.HTTPError as e:
        print(f"\n[ERROR] HTTP Error {e.code}")
        try:
            error_body = e.read().decode('utf-8')
            print(f"[ERROR] Error details: {error_body}")
        except:
            pass
        
        error_map = {
            400: 'Invalid request format',
            401: 'API key invalid',
            403: 'API access forbidden',
            404: 'Model not found',
            429: 'Rate limit exceeded (wait 60s)',
            500: 'Gemini server error',
            503: 'Service unavailable'
        }
        
        return {
            'summary': error_map.get(e.code, f'HTTP {e.code} error'),
            'threatScore': 0,
            'recommendation': 'Error'
        }
    
    except Exception as e:
        print(f"\n[ERROR] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'summary': f'Analysis failed: {type(e).__name__}',
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
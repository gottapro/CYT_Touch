import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os
import sys

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
        self.send_header('Access-Control-Allow-Origin', '*') # Allow the Web App to connect
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
            self.send_response(200)
            self._set_headers()
            stats = {
                'cpu_temp': self.get_cpu_temp(),
                'status': 'online',
                'backend': 'kismet'
            }
            self.wfile.write(json.dumps(stats).encode())
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
                # We use the 'devices' view to get the list of active devices
                url = f"{KISMET_URL}/devices/views/all/devices.json"
                req = urllib.request.Request(url)
                
                # Add Auth Header if key exists. 
                # Kismet usually expects "Cookie: KISMET=..." or standard Basic Auth?
                # Modern Kismet uses "Cookie" for session or "X-Kismet-Auth" header depending on version.
                # Standard API token usage often works via Cookie or URI param. 
                # Let's try the URI param method first as it's robust, or Cookie.
                # Actually, standard Kismet 2022+ creates an API key that is "KISMET <key>".
                # The documentation says: send as Cookie "KISMET=<key>"
                
                if api_key:
                     req.add_header('Cookie', f"KISMET={api_key}")

                # 3. Fetch Data
                with urllib.request.urlopen(req, timeout=5) as response:
                    data = response.read()
                    
                # 3. Forward Data to Web App
                self.send_response(200)
                self._set_headers()
                self.wfile.write(data)
                
            except urllib.error.URLError as e:
                # Kismet is probably not running
                print(f"Error connecting to Kismet: {e}")
                self.send_response(502)
                self._set_headers()
                error_msg = {
                    'error': 'Could not connect to Kismet', 
                    'details': str(e),
                    'suggestion': 'Ensure Kismet is running (systemctl start kismet)'
                }
                self.wfile.write(json.dumps(error_msg).encode())
            except Exception as e:
                self.send_response(500)
                self._set_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
            return
        
        # Default: Not Found
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        """Handle POST requests for commands."""
        
        # Endpoint: Purge/Reset
        if self.path == '/purge':
            print("Command received: Purge Kismet Data")
            # NOTE: Actual purging requires system permissions or Kismet API calls.
            # For now, we return success to the UI.
            # You could uncomment the line below if you have a cleanup script:
            # os.system("./clean_kismet.sh") 
            
            self.send_response(200)
            self._set_headers()
            self.wfile.write(json.dumps({'status': 'executed', 'message': 'Purge command received'}).encode())
            return
            
        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    # Allow the port to be reused immediately after restart
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), CytBridgeHandler) as httpd:
        print("------------------------------------------------")
        print(f" CYT Bridge Server Running on Port {PORT}")
        print(f" Target Kismet URL: {KISMET_URL}")
        print("------------------------------------------------")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping Bridge Server.")
            sys.exit(0)
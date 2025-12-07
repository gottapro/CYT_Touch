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
    """Call Gemini API server-side with robust error handling"""
    if not GEMINI_API_KEY:
        return {
            'summary': 'API Key not configured on server',
            'threatScore': 0,
            'recommendation': 'Config Error'
        }
    
    try:
        import urllib.request
        import json
        import re
        
        # Construct prompt
        prompt = f"""Analyze this WiFi device for security threats:

MAC: {device_data.get('mac')}
Vendor: {device_data.get('vendor', 'Unknown')}
SSID: {device_data.get('ssid', 'Hidden/Probe')}
Signal: {device_data.get('rssi')} dBm
Type: {device_data.get('type')}
Persistence: {device_data.get('persistenceScore', 0) * 100:.0f}%
Probed SSIDs: {', '.join(device_data.get('probedSSIDs', [])) or 'None'}

Respond with JSON only (no markdown, no explanation):
{{"summary": "brief analysis", "threatScore": 0-100, "recommendation": "Ignore/Monitor/Chase"}}"""
        
        # Use the correct Gemini API endpoint
        url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
        
        payload = {
            'contents': [{
                'parts': [{'text': prompt}]
            }],
            'generationConfig': {
                'temperature': 0.7,
                'maxOutputTokens': 500,
                'responseMimeType': 'application/json'  # Forces JSON response
            }
        }
        
        req = urllib.request.Request(
            f"{url}?key={GEMINI_API_KEY}",
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        print(f"[DEBUG] Calling Gemini API for device {device_data.get('mac')}")
        
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode('utf-8'))
            
            print(f"[DEBUG] Gemini response: {json.dumps(result, indent=2)}")
            
            # Parse response - handle different possible structures
            try:
                # Try to get the text content
                if 'candidates' in result and len(result['candidates']) > 0:
                    candidate = result['candidates'][0]
                    
                    # Method 1: Direct content.parts[0].text
                    if 'content' in candidate and 'parts' in candidate['content']:
                        parts = candidate['content']['parts']
                        if len(parts) > 0 and 'text' in parts[0]:
                            text = parts[0]['text']
                        else:
                            raise KeyError("No text in parts")
                    else:
                        raise KeyError("No content.parts in candidate")
                    
                    # Clean and parse JSON from response
                    text = text.strip()
                    
                    # Remove markdown code blocks if present
                    text = re.sub(r'^```json\s*', '', text)
                    text = re.sub(r'\s*```$', '', text)
                    
                    # Try to parse as JSON
                    try:
                        parsed = json.loads(text)
                        
                        # Validate structure
                        if 'summary' in parsed and 'threatScore' in parsed and 'recommendation' in parsed:
                            return parsed
                        else:
                            print(f"[WARN] Invalid JSON structure: {parsed}")
                            return {
                                'summary': parsed.get('summary', text[:200]),
                                'threatScore': parsed.get('threatScore', 50),
                                'recommendation': parsed.get('recommendation', 'Monitor')
                            }
                    except json.JSONDecodeError:
                        # If not valid JSON, extract JSON from text
                        json_match = re.search(r'\{[^{}]*"summary"[^{}]*\}', text)
                        if json_match:
                            return json.loads(json_match.group())
                        
                        # Fallback: return text as summary
                        return {
                            'summary': text[:200] if text else 'Could not parse response',
                            'threatScore': 50,
                            'recommendation': 'Monitor'
                        }
                else:
                    raise KeyError("No candidates in response")
                    
            except KeyError as ke:
                print(f"[ERROR] Response structure error: {ke}")
                print(f"[ERROR] Full response: {result}")
                
                # Try to extract any text from the response
                result_str = json.dumps(result)
                if 'blocked' in result_str.lower():
                    return {
                        'summary': 'Content blocked by safety filters',
                        'threatScore': 0,
                        'recommendation': 'Unable to analyze'
                    }
                
                return {
                    'summary': f'Unexpected API response structure: {str(ke)}',
                    'threatScore': 0,
                    'recommendation': 'Error'
                }
    
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else 'No error details'
        print(f"[ERROR] Gemini HTTP Error {e.code}: {error_body}")
        
        if e.code == 429:
            return {
                'summary': 'Rate limit exceeded. Wait 60 seconds.',
                'threatScore': 0,
                'recommendation': 'Wait'
            }
        elif e.code == 400:
            return {
                'summary': 'Invalid request to Gemini API',
                'threatScore': 0,
                'recommendation': 'Config Error'
            }
        elif e.code == 401 or e.code == 403:
            return {
                'summary': 'API key invalid or unauthorized',
                'threatScore': 0,
                'recommendation': 'Check API Key'
            }
        else:
            return {
                'summary': f'HTTP {e.code}: {error_body[:100]}',
                'threatScore': 0,
                'recommendation': 'Error'
            }
    
    except Exception as e:
        print(f"[ERROR] Gemini API Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'summary': f'Analysis failed: {type(e).__name__}',
            'threatScore': 0,
            'recommendation': 'Error'
        }


# In the do_POST method, make sure to handle the analyze endpoint:
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
import asyncio
import httpx
import json
import websockets

# URL config
BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/stream"

async def test_logic(websocket):
    print("WebSocket Connected!")
    
    # Start Stream (Synthetic Board for testing)
    print("Starting Stream via API...")
    async with httpx.AsyncClient() as client:
        # Check status
        resp = await client.get(f"{BASE_URL}/stream/status")
        print(f"Status before: {resp.json()}")

        response = await client.post(f"{BASE_URL}/stream/start", json={
            "serial_port": "",
            "board_id": -1,    # Synthetic Board
            "window_size_seconds": 2.0,
            "update_interval_seconds": 1.0,
            # NEW CONFIGS
            "channels": [1, 2], # Select only channel 2 and 3 (0-indexed)
            "target_frequency": 12.0,
            "candidate_frequencies": [8.0, 10.0, 12.0]
        })
        print(f"Start Response: {response.json()}")
    
    # Listen for messages
    print("Listening for 5 seconds...")
    for _ in range(5):
        try:
            message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
            data = json.loads(message)
            # print(f"Received payload keys: {list(data.keys())}")
            if "raw_data" in data:
                raw = data["raw_data"]
                print(f"Raw Data Shape: {len(raw)}x{len(raw[0]) if raw else 0} (Expected 2 channels)")
            
            if "classification" in data and data['classification']:
                 cls = data['classification']
                 print(f"Classification Best Freq: {cls.get('best_frequency')}")
                 print(f"Scores Keys: {list(cls.get('scores', {}).keys())} (Expected [8.0, 10.0, 12.0])")
                 
            if "plots" in data:
                print(f"Plots Received: {list(data['plots'].keys())}")
        except asyncio.TimeoutError:
            print("Timeout waiting for message")
    
    # Stop Stream
    print("Stopping Stream...")
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/stream/stop")
        print(f"Stop Response: {response.json()}")

async def test_streaming():
    print(f"Checking API status...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{BASE_URL}/stream/status")
            print(f"Status Endpoint: {resp.status_code}")
        except Exception as e:
            print(f"Status check failed: {e}")

    print(f"Connecting to WebSocket: {WS_URL}")
    
    # Debug Test
    try:
        print("Testing /ws/debug...")
        async with websockets.connect(f"{BASE_URL.replace('http','ws')}/ws/debug") as ws:
            msg = await ws.recv()
            print(f"Debug response: {msg}")
    except Exception as e:
        print(f"Connecting to WebSocket: {WS_URL}")
        print(f"Debug connection failed: {e}")

    try:
        # Increase max message size to 10MB
        async with websockets.connect(WS_URL, max_size=10_000_000) as websocket:
            await test_logic(websocket)
            return
    except Exception as e:
        print(f"First connection attempt failed: {e}")
    
    # Try with slash
    try:
        print(f"Retrying with trailing slash {WS_URL}/")
        async with websockets.connect(WS_URL + "/", max_size=10_000_000) as websocket:
            await test_logic(websocket)
            return
    except Exception as e:
         print(f"Second connection attempt failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_streaming())

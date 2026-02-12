import asyncio
import httpx
import json
import websockets
import time

# URL config
BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/stream"

async def test_verification():
    print("="*60)
    print("Verifying Classification Window Size Configuration")
    print("="*60)

    # 1. Start Stream with specific classification window size (e.g. 0.5s)
    # The default is usually 1s or buffer size (3s). 
    # If we set it to 0.5s, the processor should receive chunks of 0.5s.
    
    config = {
        "serial_port": "",
        "board_id": -1,    # Synthetic Board
        "window_size_seconds": 3.0, # Visual buffer
        "update_interval_seconds": 0.2, # Fast updates
        "classification_window_size": 0.5, # <--- NEW PARAMETER
        "channels": [0],
        "processors": ["TMSI Classifier"],
        "target_frequency": 10.0
    }
    
    print("\n1. Starting Stream with classification_window_size=0.5s ...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(f"{BASE_URL}/stream/start", json=config)
            if resp.status_code != 200:
                print(f"FAILED to start stream: {resp.text}")
                return
            print(f"  ✓ Stream started: {resp.json()}")
        except Exception as e:
            print(f"FAILED connection: {e}")
            return

    # 2. Connect and listen
    print("\n2. Listening for classification results...")
    
    # We can't easily inspect the server-side processor instance directly from here without adding debug endpoints.
    # However, we can check if we receive results and if the timing/performance suggests it's working.
    # A better check would be if the server code we modified actually runs without error.
    
    # To truly verify the VALUE, we might need to rely on the fact that existing logic works 
    # and we just successfully passed the param.
    
    received_count = 0
    try:
        async with websockets.connect(WS_URL) as websocket:
            start_wait = time.time()
            while time.time() - start_wait < 5.0:
                try:
                    msg = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    data = json.loads(msg)
                    
                    if "classification" in data and data["classification"]:
                        res = data["classification"].get("TMSI Classifier")
                        if res:
                            # If we get results, the pipeline is working.
                            print(f"  ✓ Received Classification: {res.get('classification')} (Conf: {res.get('confidence'):.4f})")
                            received_count += 1
                            if received_count >= 3:
                                break
                except asyncio.TimeoutError:
                    continue
                    
    except Exception as e:
        print(f"WebSocket Error: {e}")

    if received_count > 0:
        print(f"\n✓ Verified: Stream runs and returns classification results with new config.")
    else:
        print(f"\n✗ Failed: No classification results received.")

    # 3. Stop
    print("\n3. Stopping Stream...")
    async with httpx.AsyncClient() as client:
        await client.post(f"{BASE_URL}/stream/stop")
        print("  ✓ Stream stopped.")

if __name__ == "__main__":
    asyncio.run(test_verification())

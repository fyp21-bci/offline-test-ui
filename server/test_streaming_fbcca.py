#!/usr/bin/env python3
"""
Test script for Real-time FBCCA streaming through WebSocket.
Verifies that we can start a stream with FBCCA processor and receive classification results.
"""

import asyncio
import websockets
import json
import httpx
import sys
import time

# Configuration
BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/stream"

async def test_streaming_fbcca():
    print("=" * 60)
    print("Testing Real-time FBCCA Streaming")
    print("=" * 60)
    
    # 1. Connect WebSocket
    print("\n1. Connecting to WebSocket...")
    try:
        async with websockets.connect(WS_URL) as websocket:
            print("  ✓ Connected.")
            
            # 2. Start Stream with FBCCA
            print("\n2. Starting Stream with FBCCA Processor...")
            start_request = {
                "serial_port": "/dev/ttyUSB0", # Ignored for synthetic
                "board_id": -1, # Synthetic Board
                "window_size_seconds": 2.0,
                "update_interval_seconds": 0.5,
                "channels": [0, 1, 2],
                "processor_name": "FBCCA Classifier",
                "processor_config": {
                    "frequencies": [10.0, 12.0, 15.0],
                    "window_sec": 1.0,
                    "n_harmonics": 3
                },
                "target_frequency": 10.0
            }
            
            async with httpx.AsyncClient() as client:
                resp = await client.post(f"{BASE_URL}/stream/start", json=start_request)
                if resp.status_code == 200:
                    print(f"  ✓ Stream started: {resp.json()}")
                else:
                    print(f"  ✗ Failed to start stream: {resp.text}")
                    return False
            
            # 3. Listen for Messages
            print("\n3. Listening for classification results...")
            
            max_messages = 5
            fbcca_verified = False
            
            for i in range(max_messages):
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(message)
                    
                    if "classification" in data and data["classification"]:
                        cls_res = data["classification"]
                        print(f"  Received Message {i+1}:")
                        print(f"    Timestamp: {data.get('timestamp')}")
                        print(f"    Classification: {json.dumps(cls_res, indent=2)}")
                        
                        # Verify structure
                        if "scores" in cls_res and "best_frequency" in cls_res:
                            # Check if scores match our config frequencies
                            scores = cls_res["scores"]
                            if "10.0" in scores and "15.0" in scores:
                                print("  ✓ FBCCA Structure Verified (Correct Frequencies)")
                                fbcca_verified = True
                                break
                    else:
                         print(f"  Received Message {i+1}: No classification result yet (buffering...)")
                         
                except asyncio.TimeoutError:
                    print("  ⚠️  Timeout waiting for message")
                    break
            
            # 4. Stop Stream
            print("\n4. Stopping stream...")
            async with httpx.AsyncClient() as client:
                await client.post(f"{BASE_URL}/stream/stop")
                print("  ✓ Stream stopped.")
                
            if fbcca_verified:
                print("\n✓ TEST PASSED: Real-time FBCCA streaming verified.")
                return True
            else:
                print("\n✗ TEST FAILED: Did not receive valid FBCCA classification results.")
                return False
                
    except Exception as e:
        print(f"  ✗ Connection/Runtime error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_streaming_fbcca())
    sys.exit(0 if success else 1)

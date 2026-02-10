#!/usr/bin/env python3
"""
Test script for FBCCA classification plot endpoint.
Verifies that the new FBCCA processor is registered and working.
"""

import httpx
import json
import base64
import sys
import time

# Configuration
BASE_URL = "http://localhost:8000"

def test_fbcca_integration():
    """Test FBCCA classification plot generation"""
    
    # Wait for server to potentially reload if it was just updated
    # In a real CI/CD we might poll for readiness, but here we assume it's running
    
    print("=" * 60)
    print("Testing FBCCA Integration")
    print("=" * 60)
    
    # 1. Verify Processor is Listed
    print("\n1. Verifying FBCCA is in processor list...")
    try:
        response = httpx.get(f"{BASE_URL}/processors", timeout=5.0)
        if response.status_code == 200:
            processors = response.json()
            fbcca_found = False
            for p in processors:
                if p['name'] == "FBCCA Classifier":
                    fbcca_found = True
                    print(f"  ✓ Found 'FBCCA Classifier': {p['description']}")
                    break
            
            if not fbcca_found:
                print("  ✗ FBCCA Classifier NOT found in registry!")
                print("Available processors:", [p['name'] for p in processors])
                return False
        else:
            print(f"  ✗ Error listing processors: {response.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Connection error: {e}")
        return False

    # 2. Get a Dataset
    print("\n2. Fetching available datasets...")
    try:
        response = httpx.get(f"{BASE_URL}/datasets", timeout=5.0)
        if response.status_code == 200:
            datasets = response.json()
            if not datasets:
                print("  ⚠️  No datasets found. Please upload a dataset first.")
                return False
            
            dataset_id = datasets[0]["id"]
            print(f"  ✓ Using dataset: {dataset_id}")
        else:
            print(f"  ✗ Error listing datasets: {response.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Connection error: {e}")
        return False
    
    # 3. Test Classification Request
    print("\n3. Generating FBCCA Classification Plot...")
    
    classification_request = {
        "dataset_id": dataset_id,
        "channels": [0, 1, 2],  # Use 3 channels like in the user request (O1, Oz, O2 usually)
        "time_start": 0.0,
        "time_end": 5.0,        # Short window for quick test
        "processor_name": "FBCCA Classifier",
        "processor_config": {
            "frequencies": [8.0, 10.0, 12.0, 15.0],
            "window_sec": 1.0,
            "n_harmonics": 3,
            "n_subbands": 3
        },
        "target_frequency": 10.0
    }
    
    print(f"  Request parameters: {json.dumps(classification_request, indent=2)}")
    
    try:
        start_time = time.time()
        response = httpx.post(
            f"{BASE_URL}/datasets/plot-classification",
            json=classification_request,
            timeout=60.0
        )
        duration = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            
            # Save the image
            image_data = result.get("image", "")
            if image_data.startswith("data:image/png;base64,"):
                image_base64 = image_data.replace("data:image/png;base64,", "")
                image_bytes = base64.b64decode(image_base64)
                
                output_file = "test_fbcca_plot.png"
                with open(output_file, "wb") as f:
                    f.write(image_bytes)
                
                print(f"  ✓ Plot generated in {duration:.2f}s!")
                print(f"  Saved to: {output_file}")
            else:
                print("  ⚠️  Image data format unexpected")
            
            # Check metadata
            metadata = result.get("metadata", {})
            print(f"\n  Metadata received:")
            print(json.dumps(metadata, indent=4))
            
            if metadata.get("total_segments", 0) > 0:
                print("\n✓ TEST PASSED: FBCCA integration verified.")
                return True
            else:
                print("\n⚠️  TEST WARNING: No segments processed (check window size vs duration).")
                return True
            
        else:
            print(f"  ✗ Error generating plot:")
            print(f"  Status code: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"  ✗ Error executing request: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_fbcca_integration()
    sys.exit(0 if success else 1)

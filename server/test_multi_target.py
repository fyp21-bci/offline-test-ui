#!/usr/bin/env python3
"""
Test script for multiple target frequencies (list and comma-separated string)
"""

import httpx
import json
import base64

BASE_URL = "http://localhost:8000"

def test_targets(label, target_freq_value):
    print(f"\nTesting with target: {label} ({type(target_freq_value)})")
    print(f"Value: {target_freq_value}")
    print("-" * 60)

    classification_request = {
        "dataset_id": "OpenBCI-RAW-2026-01-31_15-02-57.txt",
        "channels": [0, 1],
        "time_start": 0.0,
        "time_end": 10.0,
        "processor_name": "TMSI Classifier",
        "processor_config": {
            "frequencies": [8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0],
            "window_sec": 1.0,
            "n_harmonics": 5
        },
        "target_frequency": target_freq_value
    }

    try:
        response = httpx.post(
            f"{BASE_URL}/datasets/plot-classification",
            json=classification_request,
            timeout=60.0
        )

        if response.status_code == 200:
            result = response.json()
            metadata = result.get("metadata", {})
            
            print("Metadata:")
            print(json.dumps(metadata, indent=2))
            
            print(f"✓ Correct: {metadata.get('correct_count', 0)}")
            print(f"✗ Incorrect: {metadata.get('incorrect_count', 0)}")
            print(f"Accuracy: {metadata.get('accuracy', 0) * 100:.1f}%")
            
            # Check if target_frequencies in metadata matches what we expect
            returned_targets = metadata.get("target_frequencies")
            print(f"Returned targets: {returned_targets}")
            
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    # Test 1: List of floats
    test_targets("List of floats", [8.0, 9.0])
    
    # Test 2: Comma-separated string
    test_targets("Comma-separated string", "8.0, 9.0")
    
    # Test 3: Single float (legacy)
    test_targets("Single float", 8.0)

#!/usr/bin/env python3
"""
Test with different window sizes
"""

import httpx
import json
import base64

BASE_URL = "http://localhost:8000"

# Test with 0.5 second windows
classification_request = {
    "dataset_id": "OpenBCI-RAW-2026-01-31_15-02-57.txt",
    "channels": [0],  # Just one channel for cleaner visualization
    "time_start": 5.0,
    "time_end": 10.0,
    "processor_name": "TMSI Classifier",
    "processor_config": {
        "frequencies": [8.0, 9.0, 10.0, 11.0, 12.0],
        "window_sec": 0.5,  # 0.5-second sub-windows (10 segments in 5 seconds)
        "n_harmonics": 5
    },
    "target_frequency": 8.0
}

print("Testing with 0.5-second window size")
print("Time window: 5.0 to 10.0 seconds")
print("=" * 60)

response = httpx.post(
    f"{BASE_URL}/datasets/plot-classification",
    json=classification_request,
    timeout=60.0
)

if response.status_code == 200:
    result = response.json()
    metadata = result.get("metadata", {})
    
    # Save the image
    image_data = result.get("image", "")
    if image_data.startswith("data:image/png;base64,"):
        image_base64 = image_data.replace("data:image/png;base64,", "")
        image_bytes = base64.b64decode(image_base64)
        
        output_file = "test_classification_plot_small_windows.png"
        with open(output_file, "wb") as f:
            f.write(image_bytes)
        
        print(f"✓ Plot saved to: {output_file}")
    
    print("\nMetadata:")
    print(json.dumps(metadata, indent=2))
    
    print(f"\nTotal segments: {metadata.get('total_segments', 0)}")
    print(f"✓ Correct: {metadata.get('correct_count', 0)}")
    print(f"✗ Incorrect: {metadata.get('incorrect_count', 0)}")
    print(f"Accuracy: {metadata.get('accuracy', 0) * 100:.1f}%")
else:
    print(f"Error: {response.status_code}")
    print(response.text)

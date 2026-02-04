#!/usr/bin/env python3
"""
Quick test with target frequency 8.0 Hz to see green backgrounds
"""

import httpx
import json
import base64

BASE_URL = "http://localhost:8000"

# Test with 8.0 Hz as target (should show more green)
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
    "target_frequency": 8.0  # Changed to 8.0 Hz
}

print("Testing with target frequency: 8.0 Hz")
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
        
        output_file = "test_classification_plot_green.png"
        with open(output_file, "wb") as f:
            f.write(image_bytes)
        
        print(f"✓ Plot saved to: {output_file}")
    
    print("\nMetadata:")
    print(json.dumps(metadata, indent=2))
    
    print(f"\n✓ Correct: {metadata.get('correct_count', 0)}")
    print(f"✗ Incorrect: {metadata.get('incorrect_count', 0)}")
    print(f"Accuracy: {metadata.get('accuracy', 0) * 100:.1f}%")
else:
    print(f"Error: {response.status_code}")
    print(response.text)

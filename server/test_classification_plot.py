#!/usr/bin/env python3
"""
Test script for classification plot endpoint.
This demonstrates how to call the classification plotting endpoint with TMSI.
"""

import httpx
import json
import base64

# Configuration
BASE_URL = "http://localhost:8000"

def test_classification_plot():
    """Test classification plot generation with TMSI"""
    
    # First, let's list available datasets
    print("=" * 60)
    print("Fetching available datasets...")
    print("=" * 60)
    
    response = httpx.get(f"{BASE_URL}/datasets")
    if response.status_code == 200:
        datasets = response.json()
        print(f"Found {len(datasets)} dataset(s):")
        for ds in datasets:
            print(f"  - {ds['id']} ({ds['size_bytes']} bytes)")
        
        if not datasets:
            print("\n⚠️  No datasets found. Please upload a dataset first.")
            return
        
        # Use the first available dataset
        dataset_id = datasets[0]["id"]
        print(f"\nUsing dataset: {dataset_id}")
    else:
        print(f"Error listing datasets: {response.status_code}")
        return
    
    # Test configuration
    print("\n" + "=" * 60)
    print("Generating CLASSIFICATION PLOT")
    print("=" * 60)
    
    classification_request = {
        "dataset_id": dataset_id,
        "channels": [0, 1],  # Plot first 2 channels
        "time_start": 0.0,   # Start at 0 seconds
        "time_end": 10.0,    # End at 10 seconds
        "processor_name": "TMSI Classifier",
        "processor_config": {
            "frequencies": [8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0],
            "window_sec": 1.0,  # 1-second sub-windows
            "n_harmonics": 5
        },
        "target_frequency": 10.0  # Target frequency for correctness evaluation
    }
    
    print(f"Request parameters:")
    print(json.dumps(classification_request, indent=2))
    
    response = httpx.post(
        f"{BASE_URL}/datasets/plot-classification",
        json=classification_request,
        timeout=60.0  # Classification can take longer
    )
    
    if response.status_code == 200:
        result = response.json()
        
        # Extract image and metadata
        image_data = result.get("image", "")
        metadata = result.get("metadata", {})
        
        # Save the image
        if image_data.startswith("data:image/png;base64,"):
            image_base64 = image_data.replace("data:image/png;base64,", "")
            image_bytes = base64.b64decode(image_base64)
            
            output_file = "test_classification_plot.png"
            with open(output_file, "wb") as f:
                f.write(image_bytes)
            
            print(f"\n✓ Classification plot generated successfully!")
            print(f"  Saved to: {output_file}")
            print(f"  Image size: {len(image_bytes)} bytes")
        else:
            print("\n⚠️  Image data format unexpected")
        
        # Display metadata
        print(f"\n" + "=" * 60)
        print("CLASSIFICATION METADATA")
        print("=" * 60)
        print(json.dumps(metadata, indent=2))
        
        # Print summary
        print(f"\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"Total segments: {metadata.get('total_segments', 0)}")
        print(f"Target frequency: {metadata.get('target_frequency', 'N/A')} Hz")
        
        if 'correct_count' in metadata:
            print(f"Correct classifications: {metadata.get('correct_count', 0)}")
            print(f"Incorrect classifications: {metadata.get('incorrect_count', 0)}")
            print(f"Accuracy: {metadata.get('accuracy', 0) * 100:.1f}%")
        
        print(f"\nFrequency distribution:")
        for freq, count in metadata.get('frequency_counts', {}).items():
            print(f"  {freq} Hz: {count} segment(s)")
        
    else:
        print(f"\n✗ Error generating classification plot:")
        print(f"  Status code: {response.status_code}")
        print(f"  Response: {response.text}")
        return

if __name__ == "__main__":
    try:
        test_classification_plot()
    except httpx.ConnectError:
        print("Error: Could not connect to the server.")
        print(f"Make sure the server is running at {BASE_URL}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

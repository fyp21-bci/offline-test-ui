#!/usr/bin/env python3
"""
Test script for both time-domain and FFT plot endpoints.
This demonstrates how to call the plotting endpoint with different plot types.
"""

import httpx
import json

# Configuration
BASE_URL = "http://localhost:8000"

def test_both_plot_types():
    """Test both time-domain and FFT plot generation"""
    
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
    test_config = {
        "dataset_id": dataset_id,
        "channels": [0, 1],  # Plot first 2 channels
        "time_start": 0.0,   # Start at 0 seconds
        "time_end": 5.0      # End at 5 seconds
    }
    
    # Test 1: Time-domain plot
    print("\n" + "=" * 60)
    print("TEST 1: Generating TIME-DOMAIN plot")
    print("=" * 60)
    
    time_request = {**test_config, "plot_type": "time"}
    print(f"Request parameters:")
    print(json.dumps(time_request, indent=2))
    
    response = httpx.post(
        f"{BASE_URL}/datasets/plot",
        json=time_request,
        timeout=30.0
    )
    
    if response.status_code == 200:
        output_file = "test_time_plot.png"
        with open(output_file, "wb") as f:
            f.write(response.content)
        print(f"\n✓ Time-domain plot generated successfully!")
        print(f"  Saved to: {output_file}")
        print(f"  Image size: {len(response.content)} bytes")
    else:
        print(f"\n✗ Error generating time-domain plot:")
        print(f"  Status code: {response.status_code}")
        print(f"  Response: {response.text}")
        return
    
    # Test 2: FFT plot
    print("\n" + "=" * 60)
    print("TEST 2: Generating FFT plot")
    print("=" * 60)
    
    fft_request = {**test_config, "plot_type": "fft"}
    print(f"Request parameters:")
    print(json.dumps(fft_request, indent=2))
    
    response = httpx.post(
        f"{BASE_URL}/datasets/plot",
        json=fft_request,
        timeout=30.0
    )
    
    if response.status_code == 200:
        output_file = "test_fft_plot.png"
        with open(output_file, "wb") as f:
            f.write(response.content)
        print(f"\n✓ FFT plot generated successfully!")
        print(f"  Saved to: {output_file}")
        print(f"  Image size: {len(response.content)} bytes")
    else:
        print(f"\n✗ Error generating FFT plot:")
        print(f"  Status code: {response.status_code}")
        print(f"  Response: {response.text}")
        return
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print("✓ Both plot types generated successfully!")
    print("  Time-domain plot: test_time_plot.png")
    print("  FFT plot: test_fft_plot.png")
    print("\nYou can now view both images to verify:")
    print("  - Time-domain shows the raw signal over time")
    print("  - FFT shows the frequency spectrum")

if __name__ == "__main__":
    try:
        test_both_plot_types()
    except httpx.ConnectError:
        print("Error: Could not connect to the server.")
        print(f"Make sure the server is running at {BASE_URL}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

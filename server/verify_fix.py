
import pandas as pd
import numpy as np
import sys
from pathlib import Path
from dataset_handler import load_openbci_multiple_channels, unwrap_sample_indices

# Path to the file that caused the error
filepath = Path("data_store/OpenBCI-RAW-12Hz-Infused.txt")

def test_loading_and_unwrapping(filepath):
    print(f"\n--- Testing Fix on {filepath} ---")
    
    if not filepath.exists():
        print(f"File not found: {filepath}")
        return False

    try:
        # Load data using the fixed function
        data, fs, sample_indices = load_openbci_multiple_channels(str(filepath))
        
        print("\nSuccess! Data loaded without crash.")
        print(f"Data shape: {data.shape}")
        print(f"Sample Indices length: {len(sample_indices)}")
        print(f"First 10 indices: {sample_indices[:10]}")
        print(f"Last 10 indices: {sample_indices[-10:]}")
        
        # Verify monotonically increasing
        diffs = np.diff(sample_indices)
        negative_diffs = diffs[diffs < 0]
        
        if len(negative_diffs) > 0:
            print(f"\n[FAIL] Found negative jumps in indices! Unwrapping failed.")
            print(f"Negative diffs: {negative_diffs}")
            return False
        else:
            print("\n[PASS] Indices are monotonically increasing.")
            
        # Check if it goes beyond 255
        if np.max(sample_indices) > 255:
             print(f"[PASS] Indices go beyond 255 (Max: {np.max(sample_indices)}), unwrapping works.")
        else:
             print(f"[WARN] Indices do not go beyond 255. Maybe short file or unwrapping issue?")
             
        return True

    except Exception as e:
        print(f"\n[FAIL] Crashed during loading: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_loading_and_unwrapping(filepath)
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

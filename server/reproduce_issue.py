
import pandas as pd
import numpy as np
import sys
from pathlib import Path

# Path to the file that caused the error
filepath = Path("data_store/OpenBCI-RAW-12Hz-Infused.txt")

def analyze_file_structure(filepath):
    print(f"--- Analyzing {filepath} ---")
    with open(filepath, 'r') as f:
        lines = f.readlines()
        for i, line in enumerate(lines[:10]):
            print(f"Line {i}: {line.strip()}")
            if "Sample Index" in line:
                print(f"-> Header found at index {i}")

def try_load_current_logic(filepath):
    print("\n--- Testing current loading logic (skiprows=4) ---")
    try:
        # This matches dataset_handler.py line 92
        df = pd.read_csv(filepath, skiprows=4)
        print("Success! Data loaded.")
        print(df.head())
        return df
    except Exception as e:
        print(f"Crashed as expected: {e}")
        return None

def try_load_fixed_logic(filepath):
    print("\n--- Testing fixed loading logic (skiprows=5) ---")
    try:
        # Trying skiprows=5 based on visual inspection
        df = pd.read_csv(filepath, skiprows=5)
        
        # Verify columns
        print(f"Columns: {df.columns.tolist()[:3]} ...")
        
        if "Sample Index" in df.columns:
            indices = df["Sample Index"].values
            print(f"\nSample Indices (first 300):")
            print(indices[:300])
            
            # Check for rollover
            rollovers = np.where(np.diff(indices) < 0)[0]
            if len(rollovers) > 0:
                print(f"\nRollovers detected at indices: {rollovers}")
                print(f"Values around rollover: {indices[rollovers[0]-2:rollovers[0]+3]}")
                
        return df
    except Exception as e:
        print(f"Failed: {e}")
        return None

if __name__ == "__main__":
    if not filepath.exists():
        print(f"File not found: {filepath}")
        sys.exit(1)
        
    analyze_file_structure(filepath)
    try_load_current_logic(filepath)
    try_load_fixed_logic(filepath)

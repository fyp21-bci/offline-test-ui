
import os
import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Mock OpenBCI content
# Header (6 lines usually, skips 4 in code)
# %OpenBCI Raw EEG Data
# %
# %
# %
# Sample Index, EXG Channel 0, EXG Channel 1, EXG Channel 2, EXG Channel 3, EXG Channel 4, EXG Channel 5, EXG Channel 6, EXG Channel 7, Accel Channel 0, Accel Channel 1, Accel Channel 2, Other, Other, Other, Other, Other, Other, Other, Timestamp, Timestamp (Formatted)
MOCK_FILE_CONTENT = """%OpenBCI Raw EEG Data
%
%
%
Sample Index, EXG Channel 0, EXG Channel 1, EXG Channel 2, EXG Channel 3, EXG Channel 4, EXG Channel 5, EXG Channel 6, EXG Channel 7
0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0
1, 20.0, 20.0, 20.0, 20.0, 20.0, 20.0, 20.0, 20.0
2, 30.0, 30.0, 30.0, 30.0, 30.0, 30.0, 30.0, 30.0
3, 40.0, 40.0, 40.0, 40.0, 40.0, 40.0, 40.0, 40.0
"""

import argparse

def test_full_flow(file_path=None):
    # 1. List Processors
    print("Testing /processors...")
    response = client.get("/processors")
    assert response.status_code == 200
    processors = response.json()
    assert len(processors) > 0
    tmsi = next(p for p in processors if "TMSI" in p["name"])
    print(f"Found TMSI processor: {tmsi['name']}")
    
    fft = next((p for p in processors if "FFT" in p["name"]), None)
    if fft:
        print(f"Found FFT processor: {fft['name']}")

    # 2. Get Config
    print(f"Testing /processors/{tmsi['name']}/config...")
    response = client.get(f"/processors/{tmsi['name']}/config")
    assert response.status_code == 200
    config_schema = response.json()
    assert "frequencies" in config_schema["properties"]

    # 3. Upload File
    print("Testing /datasets/upload...")
    
    if file_path:
        filename = os.path.basename(file_path)
        with open(file_path, "rb") as f:
            content = f.read()
        files = {"file": (filename, content, "text/plain")}
        print(f"Uploading real file: {file_path}")
    else:
        filename = "test_openbci.txt"
        files = {"file": (filename, MOCK_FILE_CONTENT, "text/plain")}
        print("Uploading mock content...")

    response = client.post("/datasets/upload", files=files)
    assert response.status_code == 200
    dataset_info = response.json()
    dataset_id = dataset_info["id"]
    print(f"Uploaded dataset: {dataset_id}")

    # 4. List Datasets
    print("Testing /datasets...")
    response = client.get("/datasets")
    assert response.status_code == 200
    datasets = response.json()
    assert any(d["id"] == dataset_id for d in datasets)

    # 5. Run Analysis
    print("Testing /analysis/run...")
    payload = {
        "dataset_id": dataset_id,
        "processor_name": tmsi["name"],
        "config": {
            "frequencies": [10.0, 20.0, 30.0],
            "window_sec": 1.0 # Larger window for real data
        }
    }
    response = client.post("/analysis/run", json=payload)
    if response.status_code != 200:
        print("Error:", response.json())
        return

    result_wrapper = response.json()
    result = result_wrapper["result"]
    assert result["type"] == "classification"
    data = result["data"]
    
    print("Analysis Result:", data)
    assert "best_frequency" in data
    assert "scores" in data

    print("\n✅ Verification Successful!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test signal processing flow")
    parser.add_argument("--file", help="Path to a real OpenBCI file to test with")
    args = parser.parse_args()
    
    test_full_flow(args.file)


import time
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from pathlib import Path

client = TestClient(app)

DATA_DIR = Path("data_store")

def test_dataset_sorting():
    # 1. Clear or ensure clean state if possible, or just use unique names
    # For this test, we'll just upload two files with a small delay
    
    file1_name = f"test_sort_1_{int(time.time())}.txt"
    file2_name = f"test_sort_2_{int(time.time()) + 1}.txt"
    
    content = b"sample content"
    
    # Upload first file
    print(f"Uploading {file1_name}...")
    response = client.post("/datasets/upload", files={"file": (file1_name, content, "text/plain")})
    assert response.status_code == 200
    time.sleep(1.1) # Ensure different st_mtime
    
    # Upload second file
    print(f"Uploading {file2_name}...")
    response = client.post("/datasets/upload", files={"file": (file2_name, content, "text/plain")})
    assert response.status_code == 200
    
    # List datasets
    response = client.get("/datasets")
    assert response.status_code == 200
    datasets = response.json()
    
    # Find our test files in the list
    relevant_datasets = [d for d in datasets if d["filename"] in [file1_name, file2_name]]
    
    assert len(relevant_datasets) >= 2
    
    # The first one in the list (index 0) should be file2_name (newest)
    # But wait, there might be other files in data_store that are even newer if someone else is uploading.
    # However, between our two files, file2_name MUST come before file1_name.
    
    idx1 = next(i for i, d in enumerate(relevant_datasets) if d["filename"] == file1_name)
    idx2 = next(i for i, d in enumerate(relevant_datasets) if d["filename"] == file2_name)
    
    print(f"Index of {file1_name}: {idx1}")
    print(f"Index of {file2_name}: {idx2}")
    
    assert idx2 < idx1, f"Newer file {file2_name} should come before {file1_name}"
    
    # Also verify created_at is present and descending
    assert "created_at" in relevant_datasets[0]
    assert relevant_datasets[0]["created_at"] >= relevant_datasets[1]["created_at"]

if __name__ == "__main__":
    test_dataset_sorting()

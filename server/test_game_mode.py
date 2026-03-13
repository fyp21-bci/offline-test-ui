
from fastapi.testclient import TestClient
from app.main import app
from app.core.stream_manager import StreamManager
import time

client = TestClient(app)

def test_game_mode_stream():
    # Helper to clean up
    def stop_stream():
        client.post("/stream/stop")
        
    # Ensure stream is stopped
    stop_stream()
    
    # 1. Start Game stream
    payload = {
        "serial_port": "/dev/ttyUSB0",
        "board_id": -1, # Synthetic
        "window_length": 2.0,
        "refresh_rate": 0.1,
        "algorithms": ["TMSI Classifier"],
        "candidate_frequencies": [10.0, 12.0]
    }
    
    response = client.post("/stream/game/start", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    # 2. Verify StreamManager state
    sm = StreamManager()
    assert sm.is_streaming == True
    assert sm.generate_plots == False
    assert sm.classification_window_size == 2.0
    assert sm.update_interval_seconds == 0.1
    
    # 3. Wait for a processing cycle
    time.sleep(1.0)
    
    # 4. Stop stream
    stop_stream()
    assert sm.is_streaming == False

if __name__ == "__main__":
    test_game_mode_stream()
    print("Test passed!")

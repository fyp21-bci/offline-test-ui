
import time
import sys
import os
import threading
import numpy as np
from unittest.mock import MagicMock
from pathlib import Path

# Add app to path
sys.path.append("/home/dinujaya/fyp/testing-ui/server")

from app.core.stream_manager import StreamManager
from brainflow.board_shim import BoardIds

def test_recording():
    print("Testing Enhanced Recording Feature...")
    
    # Mock BoardShim
    mock_board = MagicMock()
    mock_board.get_board_data.return_value = np.random.rand(32, 250)
    mock_board.get_sampling_rate.return_value = 250
    mock_board.get_num_rows.return_value = 32
    mock_board.get_eeg_channels.return_value = list(range(1, 9))
    mock_board.get_package_num_channel.return_value = 0
    mock_board.get_timestamp_channel.return_value = 31
    mock_board.is_prepared.return_value = True
    
    sm = StreamManager()
    
    # Patch BoardShim in app.core.stream_manager
    import app.core.stream_manager
    original_board_shim = app.core.stream_manager.BoardShim
    app.core.stream_manager.BoardShim = MagicMock(return_value=mock_board)
    
    try:
        # Start Stream
        print("Starting stream...")
        sm.start_stream(board_id=BoardIds.SYNTHETIC_BOARD.value)
        time.sleep(1)
        
        # Start Named Recording
        rec_name = "test_session_automated"
        print(f"Starting recording with name: {rec_name}...")
        sm.start_recording(filename=rec_name)
        assert sm.is_recording
        assert sm.recording_filename == f"recordings/{rec_name}.txt"
        
        # Wait
        time.sleep(2)
        
        # Stop
        print("Stopping recording...")
        sm.stop_recording()
        assert not sm.is_recording
        
        # Wait for save
        time.sleep(1)
        
        # Verify File in correct location
        expected_path = Path("data_store/recordings") / f"{rec_name}.txt"
        if expected_path.exists():
            print(f"✅ File created at {expected_path}")
            assert expected_path.stat().st_size > 0
        else:
            print(f"❌ File not found at {expected_path}")
            
    except Exception as e:
        print(f"❌ Verification Failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        sm.stop_stream()
        app.core.stream_manager.BoardShim = original_board_shim

if __name__ == "__main__":
    test_recording()

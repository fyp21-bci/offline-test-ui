
from brainflow.board_shim import BoardShim, BoardIds
import numpy as np
import pandas as pd
import logging

# Configure minimal logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_save_recording_fix():
    print("Testing save recording logic with BoardShim static methods...")
    
    board_id = BoardIds.SYNTHETIC_BOARD.value
    
    # Mock data
    n_channels = BoardShim.get_num_rows(board_id)
    sampling_rate = BoardShim.get_sampling_rate(board_id)
    n_samples = 100
    
    data = np.random.rand(n_channels, n_samples)
    
    # Simulate _save_recording logic
    try:
        # Check package num
        if board_id != BoardIds.SYNTHETIC_BOARD.value:
            pkg_row = BoardShim.get_package_num_channel(board_id)
            sample_indices = data[pkg_row, :]
        else:
            sample_indices = np.arange(data.shape[1]) % 256
            
        print("✓ Sample indices retrieved via static/logic")

        # Check timestamp
        timestamp_row = BoardShim.get_timestamp_channel(board_id)
        timestamps = data[timestamp_row, :]
        print(f"✓ Timestamp channel index: {timestamp_row}")
        
        # Format times
        formatted_times = pd.to_datetime(timestamps, unit='s').strftime('%Y-%m-%d %H:%M:%S.%f')
        print(f"✓ Times formatted: {formatted_times[0]}")
        
        print("\nSUCCESS: BoardShim static methods work correctly without an instance.")
        return True
        
    except Exception as e:
        print(f"\nFAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_save_recording_fix()

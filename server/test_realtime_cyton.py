from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds
import time
import numpy as np

def main():
    # Enable logging (optional)
    BoardShim.enable_dev_board_logger()

    params = BrainFlowInputParams()
    params.serial_port = "/dev/ttyUSB0"   # change if needed

    board_id = BoardIds.CYTON_BOARD.value
    board = BoardShim(board_id, params)

    try:
        board.prepare_session()
        board.start_stream()

        print("Streaming... Press Ctrl+C to stop")

        while True:
            time.sleep(0.1)
            # get_current_board_data gets the data from the internal buffer and removes it
            # getting 250 samples (approx 1 second for Cyton's 250Hz)
            data = board.get_current_board_data(250) 
            
            if data.shape[1] == 0:
                print("No data yet...")
                continue

            eeg_channels = BoardShim.get_eeg_channels(board_id)
            eeg_data = data[eeg_channels, :]
            
            # User asked to "serial print real time openbci cyton signal"
            # We print the shape and the latest sample values
            print(f"Data Shape: {eeg_data.shape}")
            
            # Print the most recent sample for all EEG channels
            # Cyton has 8 EEG channels usually
            if eeg_data.shape[1] > 0:
                latest_sample = eeg_data[:, -1]
                # Formatting for cleaner output
                formatted_data = ", ".join([f"{x:.2f}" for x in latest_sample])
                print(f"Latest Sample (uV): [{formatted_data}]")

    except KeyboardInterrupt:
        print("\nInterrupted by user.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        print("Releasing session...")
        if board.is_prepared():
            board.stop_stream()
            board.release_session()
        print("Done.")

if __name__ == "__main__":
    main()

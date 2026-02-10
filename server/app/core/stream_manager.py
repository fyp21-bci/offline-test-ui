import threading
import time
import asyncio
import numpy as np
import collections
import logging
from typing import List, Optional, Dict, Any
from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds

import json
from app.core.types import SignalData
from app.core.types import SignalData
from app.core.registry import Registry
from app.modules.processors.preprocessing import PreprocessingProcessor

import base64
from io import BytesIO
import matplotlib.pyplot as plt
from app.core.plotting import plot_time_domain, plot_frequency_domain, plot_classification

# Configure logging
logger = logging.getLogger(__name__)

class StreamManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(StreamManager, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        if self.initialized:
            return
            
        self.initialized = True
        self.is_streaming = False
        self.board: Optional[BoardShim] = None
        self.lock = threading.Lock()
        
        # Threads
        self.acquisition_thread: Optional[threading.Thread] = None
        self.processing_thread: Optional[threading.Thread] = None
        self.stop_event = threading.Event()
        
        # Buffering
        self.window_size_seconds = 3.0
        self.update_interval_seconds = 1.0
        self.sampling_rate = 250  # Default, will update from board
        self.buffer_lock = threading.Lock()
        self.data_buffer = np.zeros((0, 0)) # Placeholder
        
        # Websockets
        self.active_websockets = set()
        
        # Config
        self.params = BrainFlowInputParams()
        self.board_id = BoardIds.CYTON_BOARD.value

    async def connect_client(self, websocket):
        """Register a new websocket client."""
        await websocket.accept()
        self.active_websockets.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.active_websockets)}")
        try:
            while True:
                # Keep connection open and listen for messages if needed (e.g. heartbeat)
                # For now just wait for disconnect
                data = await websocket.receive_text()
        except Exception as e:
            logger.info(f"Client disconnected: {e}")
        finally:
            self.active_websockets.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """Send message to all connected clients."""
        if not self.active_websockets:
            return
            
        # Create a list of tasks to run concurrently
        to_remove = set()
        for ws in self.active_websockets:
            try:
                await ws.send_json(message)
            except Exception:
                to_remove.add(ws)
        
        self.active_websockets -= to_remove

    def start_stream(
        self, 
        serial_port: str = "/dev/ttyUSB0", 
        board_id: Optional[int] = None, 
        window_size: float = 3.0, 
        update_interval: float = 1.0,
        channels: Optional[List[int]] = None,
        target_frequency: Optional[float] = None,
        candidate_frequencies: Optional[List[float]] = None,
        processor_name: str = "TMSI Classifier",
        processor_config: Optional[Dict[str, Any]] = None
    ):
        """Start the BrainFlow streaming and processing threads."""
        with self.lock:
            if self.is_streaming:
                logger.warning("Stream already running")
                return

            logger.info(f"Starting stream on {serial_port}")
            
            # Setup BrainFlow
            self.params.serial_port = serial_port
            
            use_board_id = board_id if board_id is not None else self.board_id
            
            self.board = BoardShim(use_board_id, self.params)
            
            try:
                self.board.prepare_session()
                self.board.start_stream()
                self.sampling_rate = self.board.get_sampling_rate(self.board_id)
                self.n_channels = self.board.get_num_rows(self.board_id) # Total channels including accel etc.
                self.eeg_channels = self.board.get_eeg_channels(self.board_id)
                
                # Configs
                self.selected_channels = channels # User selected indices relative to EEG channels (0, 1, 2...)
                self.target_frequency = target_frequency
                self.candidate_frequencies = candidate_frequencies
                
                self.processor_name = processor_name
                self.processor_config = processor_config or {}
                
                # Initialize Buffer
                # We need to store ALL channels to keep structure consistent, 
                # but we'll mostly focus on EEG channels for processing.
                buffer_samples = int(window_size * self.sampling_rate)
                self.data_buffer = np.zeros((self.n_channels, 0)) # Start empty
                self.max_buffer_samples = buffer_samples
                self.window_size_seconds = window_size
                self.update_interval_seconds = update_interval
                
                self.is_streaming = True
                self.stop_event.clear()
                
                # Start Threads
                self.acquisition_thread = threading.Thread(target=self._acquisition_loop, daemon=True)
                self.processing_thread = threading.Thread(target=self._processing_loop, daemon=True)
                
                self.acquisition_thread.start()
                self.processing_thread.start()
                
            except Exception as e:
                logger.error(f"Failed to start stream: {e}")
                self._cleanup_board()
                raise e

    def stop_stream(self):
        """Stop streaming and cleanup."""
        with self.lock:
            if not self.is_streaming:
                return

            logger.info("Stopping stream...")
            self.is_streaming = False
            self.stop_event.set()
            
            # Wait for threads
            if self.acquisition_thread:
                self.acquisition_thread.join(timeout=2.0)
            if self.processing_thread:
                self.processing_thread.join(timeout=2.0)
                
            self._cleanup_board()
            logger.info("Stream stopped.")

    def _cleanup_board(self):
        """Release BrainFlow session."""
        if self.board and self.board.is_prepared():
            try:
                self.board.stop_stream()
                self.board.release_session()
            except Exception as e:
                logger.error(f"Error releasing session: {e}")
        self.board = None

    def _acquisition_loop(self):
        """Thread A: Continuously read data and push to buffer."""
        logger.info("Acquisition thread started")
        while not self.stop_event.is_set():
            try:
                if not self.board:
                    break
                    
                # Get all available data (clears internal buffer)
                data = self.board.get_board_data()
                
                if data.shape[1] > 0:
                    with self.buffer_lock:
                        # Append new data
                        if self.data_buffer.shape[1] == 0:
                            self.data_buffer = data
                        else:
                            self.data_buffer = np.hstack((self.data_buffer, data))
                        
                        # Maintain fixed window size (discard oldest)
                        current_samples = self.data_buffer.shape[1]
                        if current_samples > self.max_buffer_samples:
                            # Keep only the last N samples
                            self.data_buffer = self.data_buffer[:, -self.max_buffer_samples:]
                            
                time.sleep(0.01) # Poll frequently to keep internal buffer empty
            except Exception as e:
                logger.error(f"Acquisition error: {e}")
                break


    def _processing_loop(self):
        """Thread B: Periodic processing and broadcasting."""
        logger.info("Processing thread started")
        
        # We need an event loop to run async broadcast from this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Initialize Processor
        processor_class = Registry.get_processor(getattr(self, 'processor_name', "TMSI Classifier"))
        if not processor_class:
            logger.error(f"Processor {self.processor_name} not found, falling back to TMSI Classifier")
            processor_class = Registry.get_processor("TMSI Classifier")
            
        processor_instance = processor_class() if processor_class else None
        
        while not self.stop_event.is_set():
            start_time = time.time()
            try:
                # Snapshot buffer
                with self.buffer_lock:
                    if self.data_buffer.shape[1] < int(self.sampling_rate * 0.5): # Minimum 0.5s
                        snapshot = None
                    else:
                        snapshot = self.data_buffer.copy()
                
                if snapshot is not None:
                    # PROPOSE: Preprocessing & Analysis
                    # 1. Extract EEG
                    all_eeg_data = snapshot[self.eeg_channels, :]
                    
                    # Filter user selected channels if specified
                    if self.selected_channels and len(self.selected_channels) > 0:
                        # Ensure indices are valid
                        valid_indices = [i for i in self.selected_channels if i < all_eeg_data.shape[0]]
                        if valid_indices:
                             eeg_data = all_eeg_data[valid_indices, :]
                             # Update channel names for plots later
                             plot_channel_names = [f"Ch{i+1}" for i in valid_indices]
                        else:
                            eeg_data = all_eeg_data
                            plot_channel_names = [f"Ch{i+1}" for i in range(all_eeg_data.shape[0])]
                    else:
                        eeg_data = all_eeg_data
                        plot_channel_names = [f"Ch{i+1}" for i in range(all_eeg_data.shape[0])]
                        
                    n_channels, n_samples = eeg_data.shape
                    
                    # 1b. Apply Preprocessing (Detrend, Filter)
                    # Wrap in SignalData for processor
                    raw_sig_data = SignalData(
                        data=eeg_data.tolist(),
                        fs=self.sampling_rate,
                        channel_names=plot_channel_names
                    )
                    
                    try:
                        preprocessed_sig = PreprocessingProcessor.apply_default_preprocessing(raw_sig_data)
                        # Extract back to numpy for FFT/Plots
                        eeg_data = np.array(preprocessed_sig.data)
                    except Exception as e:
                        logger.error(f"Preprocessing failed: {e}")
                        # Fallback to raw data if fails
                    
                    # 2. FFT Processing (Aggregated)
                    # Use last 1 second for FFT 
                    # If window is smaller than 1s, use what we have
                    fft_window_size = min(int(self.sampling_rate), n_samples)
                    fft_slice = eeg_data[:, -fft_window_size:]
                    
                    # Compute FFT
                    # rfft returns complex output, we want magnitude
                    fft_values = np.fft.rfft(fft_slice, axis=1)
                    fft_magnitude = np.abs(fft_values)
                    # Frequency bins
                    freqs = np.fft.rfftfreq(fft_slice.shape[1], 1/self.sampling_rate)
                    
                    # Filter 0-60Hz
                    mask = (freqs <= 60)
                    freqs_filtered = freqs[mask]
                    mag_filtered = fft_magnitude[:, mask]
                    
                    # Average across channels for visualization
                    avg_magnitude = np.mean(mag_filtered, axis=0)
                    
                    # 3. Classification
                    classification_result = None
                    # We run classification on the FULL window if it's large enough (e.g. >1s)
                    # TMSI usually needs ~1s. 
                    if n_samples >= int(self.sampling_rate):
                        # Create SignalData wrapper
                        sig_data = SignalData(
                            data=eeg_data.tolist(),
                            fs=self.sampling_rate,
                            channel_names=plot_channel_names
                        )
                        
                        # Use default frequencies if not set in start_stream (to be implemented), 
                        # or just a standard SSVEP range.
                        # For now, let's use a standard range or the input params.
                        # We'll just use the default TMSI config but ensure window_sec matches our data
                        
                        # Determine actual window length in seconds
                        actual_duration = n_samples / self.sampling_rate
                        
                        # Determine frequencies to use
                        use_freqs = self.candidate_frequencies if self.candidate_frequencies else [8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0]
                        
                        # Determine actual window length in seconds
                        actual_duration = n_samples / self.sampling_rate
                        
                        config = {
                            "frequencies": use_freqs,
                            "window_sec": actual_duration,
                            "n_harmonics": 5
                        }
                        
                        # Override with user config if provided
                        if getattr(self, 'processor_config', None):
                            config.update(self.processor_config)
                        
                        try:
                            # We only want ONE result for the current window.
                            # TMSIProcessor splits into windows. If we pass the whole buffer as one "window_sec",
                            # it should produce one result.
                            # BUT TMSIProcessor builds the Laplacian based on window_sec.
                            # If we pass exactly the buffer length, it should work.
                            
                            if processor_instance:
                                res = processor_instance.process(sig_data, config)
                                results_list = res.data.get("results", [])
                                if results_list:
                                    classification_result = results_list[-1] # Get latest
                        except Exception as proc_e:
                            logger.error(f"Classification failed: {proc_e}")



                    # ... (rest of preprocessing) ...
                    
                    # 4. Generate Images (High-Res Plots)
                    images_payload = {}
                    
                    try:
                        # 4a. Time Domain Plot
                        # Use eeg_channels from board for labelling
                        # If board not available (e.g. stopped?), fallback
                        channel_names = [f"Ch{i+1}" for i in range(n_channels)]
                        time_axis = np.linspace(0, n_samples/self.sampling_rate, n_samples)
                        
                        fig1 = plot_time_domain(
                            eeg_data, 
                            time_axis, 
                            list(range(n_channels)), 
                            channel_names
                        )
                        buf1 = BytesIO()
                        fig1.savefig(buf1, format='png', dpi=100, bbox_inches='tight')
                        plt.close(fig1)
                        images_payload['time_plot'] = "data:image/png;base64," + base64.b64encode(buf1.getvalue()).decode('utf-8')
                        
                        # 4b. FFT Plot
                        fig2 = plot_frequency_domain(
                            eeg_data, 
                            self.sampling_rate, 
                            list(range(n_channels)), 
                            plot_channel_names
                        )
                        buf2 = BytesIO()
                        fig2.savefig(buf2, format='png', dpi=100, bbox_inches='tight')
                        plt.close(fig2)
                        images_payload['fft_plot'] = "data:image/png;base64," + base64.b64encode(buf2.getvalue()).decode('utf-8')
                        
                        # 4c. Classification Plot
                        if classification_result:
                            # Use configured target frequency for coloring (set)
                            target_freqs = set()
                            if self.target_frequency:
                                target_freqs.add(self.target_frequency)
                            
                            # SignalData wrapper again if we didn't save it
                            sig_data_for_plot = SignalData(
                                data=eeg_data.tolist(),
                                fs=self.sampling_rate,
                                channel_names=plot_channel_names
                            )
                            
                            # We only have one result, but the plotter expects a list
                            # The plotter highlights segments.
                            
                            fig3 = plot_classification(
                                sig_data_for_plot,
                                [classification_result], # List of 1
                                0, # time_start
                                n_samples/self.sampling_rate, # time_end
                                list(range(n_channels)),
                                plot_channel_names,
                                target_frequencies=target_freqs if target_freqs else None
                            )
                            buf3 = BytesIO()
                            fig3.savefig(buf3, format='png', dpi=100, bbox_inches='tight')
                            plt.close(fig3)
                            images_payload['classification_plot'] = "data:image/png;base64," + base64.b64encode(buf3.getvalue()).decode('utf-8')
                            
                    except Exception as plot_e:
                        logger.error(f"Plotting failed: {plot_e}")

                    # Construct Payload
                    payload = {
                        "timestamp": time.time(),
                        "fs": self.sampling_rate,
                        "raw_data": eeg_data.tolist(), 
                        "fft": {
                            "freqs": freqs_filtered.tolist(),
                            "magnitude": avg_magnitude.tolist()
                        },
                        "classification": classification_result,
                        "plots": images_payload, # New field
                        "status": "streaming"
                    }
                    
                    # Run async broadcast
                    loop.run_until_complete(self.broadcast(payload))
            
            except Exception as e:
                logger.error(f"Processing error: {e}")
            
            # Sleep remainder of interval
            elapsed = time.time() - start_time
            sleep_time = max(0, self.update_interval_seconds - elapsed)
            time.sleep(sleep_time)

    def get_status(self):
        return {
            "is_streaming": self.is_streaming,
            "port": self.params.serial_port,
            "window_size": self.window_size_seconds,
            "clients": len(self.active_websockets)
        }

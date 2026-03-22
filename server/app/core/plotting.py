import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import MultipleLocator
from typing import List, Dict, Any, Optional, Set

from app.core.types import SignalData

def plot_time_domain(
    time_slice: np.ndarray,
    time_axis: np.ndarray,
    channel_indices: List[int],
    channel_names: List[str]
) -> plt.Figure:
    """
    Generate a time-domain plot for signal data.
    
    Args:
        time_slice: Signal data array (channels x samples)
        time_axis: Time values in seconds
        channel_indices: List of channel indices to plot
        channel_names: List of all channel names
    
    Returns:
        matplotlib Figure object
    """
    fig, axes = plt.subplots(
        len(channel_indices), 
        1, 
        figsize=(16, 2 * len(channel_indices)),
        squeeze=False
    )
    
    # Set dark/modern style if possible, or just keep default
    # plt.style.use('dark_background') # Global effect, might affect other things
    
    for i, ch_idx in enumerate(channel_indices):
        ax = axes[i, 0]
        ax.plot(time_axis, time_slice[ch_idx, :], linewidth=0.8)
        ax.set_ylabel(channel_names[ch_idx])
        ax.grid(True, alpha=0.3)
        
        # Remove x-tick labels for all but bottom subplot
        if i < len(channel_indices) - 1:
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel('Time (s)')
    
    plt.tight_layout()
    return fig

def plot_frequency_domain(
    time_slice: np.ndarray,
    fs: float,
    channel_indices: List[int],
    channel_names: List[str]
) -> plt.Figure:
    """
    Generate a frequency-domain (FFT) plot for signal data.
    
    Args:
        time_slice: Signal data array (channels x samples)
        fs: Sampling frequency in Hz
        channel_indices: List of channel indices to plot
        channel_names: List of all channel names
    
    Returns:
        matplotlib Figure object
    """
    fig, axes = plt.subplots(
        len(channel_indices), 
        1, 
        figsize=(16, 2 * len(channel_indices)),
        squeeze=False
    )
    
    for i, ch_idx in enumerate(channel_indices):
        # Compute FFT
        signal = time_slice[ch_idx, :]
        n_samples = len(signal)
        
        # Use rfft for real signals (more efficient)
        fft_values = np.fft.rfft(signal)
        fft_magnitude = np.abs(fft_values)
        fft_frequencies = np.fft.rfftfreq(n_samples, 1/fs)
        
        # Plot
        ax = axes[i, 0]
        ax.plot(fft_frequencies, fft_magnitude, linewidth=0.8)
        ax.set_ylabel(f"{channel_names[ch_idx]}\nMagnitude")
        ax.set_xlim(0.1, 30)  # Limit frequency range to (0.1-30Hz)
        
        # Grid settings: bold 1Hz intervals, subtle 0.1Hz intervals
        ax.xaxis.set_major_locator(MultipleLocator(1.0))
        ax.xaxis.set_minor_locator(MultipleLocator(0.1))
        ax.grid(True, which='major', axis='x', color='black', linewidth=1, alpha=0.4)
        ax.grid(True, which='minor', axis='x', color='gray', linewidth=0.5, alpha=0.2)
        ax.grid(True, which='major', axis='y', alpha=0.3)
        
        # Remove x-tick labels for all but bottom subplot
        if i < len(channel_indices) - 1:
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel('Frequency (Hz)')
    
    plt.tight_layout()
    return fig

def plot_classification(
    signal_data: SignalData,
    classification_results: List[Dict[str, Any]],
    time_start: float,
    time_end: float,
    channel_indices: List[int],
    channel_names: List[str],
    target_frequencies: Optional[Set[float]] = None,
    title: Optional[str] = None
) -> plt.Figure:
    """
    Generate a classification plot with color-coded backgrounds.
    
    Args:
        signal_data: Full signal data (or windowed data)
        classification_results: List of classification results for each sub-window
        time_start: Start time in seconds
        time_end: End time in seconds
        channel_indices: List of channel indices to plot
        channel_names: List of all channel names
        target_frequencies: Optional set of target frequencies for correctness evaluation
        title: Optional title for the plot
    
    Returns:
        matplotlib Figure object
    """
    fs = signal_data.fs
    data_array = np.array(signal_data.data)
    
    fig, axes = plt.subplots(
        len(channel_indices), 
        1, 
        figsize=(16, 2 * len(channel_indices)),
        squeeze=False
    )
    
    if title:
        fig.suptitle(title, fontsize=14)
    
    for i, ch_idx in enumerate(channel_indices):
        ax = axes[i, 0]
        
        # Plot each sub-window with its averaged signal and colored background
        for result in classification_results:
            # Handle results that might be absolute or relative depending on context
            # We assume results match the time_start/end references
            start_time = result['start_time']
            end_time = result['end_time']
            best_freq = result['best_frequency']
            
            # If we are plotting a small window, ensure we don't crash on indices
            # Convert to sample indices relative to the start of the data array
            # If data_array matches the window exactly, then 0 corresponds to time_start
            
            # Since this function takes 'signal_data', we assume data_array corresponds to [time_start, time_end]
            # BUT the original code in routes.py assumed 'signal_data' was the FULL dataset.
            # In streaming context, 'signal_data' will likely be the CURRENT BUFFER window.
            # So 0.0 time in 'classification_results' might relate to the start of the buffer.
            # We need to be careful with time alignment.
            
            # For simplicity in this reuse:
            # We assume classification_results start_time/end_time are consistent with time_start/time_end
            
            # Case 1: classification_results are absolute times, and time_start is absolute
            # Case 2: classification_results are relative to window (0..3s), and time_start is 0
            
            # Let's trust the Caller to align times.
            
            # Convert time to relative sample index from the start of data_array
            # This logic assumes data_array starts at time_start? 
            # Or data_array is the full thing?
            
            # Let's adjust based on routes.py logic:
            # In routes.py:
            # start_sample = int(start_time * fs) <-- absolute sample index from 0
            # window_signal = data_array[ch_idx, start_sample:end_sample]
            
            # If data_array is just the window, then we need relative times.
            
            # If start_time is huge (absolute timestamp), but data_array is small (window), we need to shift.
            # But usually signal_data provided here contains the data for the relevant range.
            
            # To make this robust:
            # We will use sample indices calculated from fs
            
            start_sample = int((start_time) * fs)
            end_sample = int((end_time) * fs)
            
            # Bounds check
            if start_sample < 0:
                start_sample = 0
            if end_sample > data_array.shape[1]:
                end_sample = data_array.shape[1]
            
            if start_sample >= end_sample:
                continue  # Skip invalid
            
            # Extract sub-window signal
            # This assumes data_array indices [0..N] map to Time [0..N/fs]
            # So if start_time=1.0, we take samples from fs*1.0. 
            window_signal = data_array[ch_idx, start_sample:end_sample]
            
            # Calculate averaged signal (mean of the signal)
            averaged_signal = np.mean(window_signal)
            
            # Create time axis for this window
            time_axis = np.linspace(start_time, end_time, len(window_signal))
            
            # Determine background color
            if target_frequencies:
                # Check if best_freq is close to ANY of the target frequencies
                is_correct = any(abs(best_freq - tf) < 0.01 for tf in target_frequencies)
                color = 'green' if is_correct else 'red'
                alpha = 0.2
            else:
                color = 'gray'
                alpha = 0.1
            
            # Add colored background
            ax.axvspan(start_time, end_time, color=color, alpha=alpha)
            
            # Plot the averaged signal as a horizontal line for this window
            ax.hlines(averaged_signal, start_time, end_time, colors='blue', linewidth=1.5)
            
            # Also plot the actual signal in lighter color
            ax.plot(time_axis, window_signal, linewidth=0.5, alpha=0.5, color='navy')
        
        ax.set_ylabel(f'{channel_names[ch_idx]}')
        ax.set_xlim(time_start, time_end)
        ax.grid(True, alpha=0.3)
        
        # Remove x-tick labels for all but bottom subplot
        if i < len(channel_indices) - 1:
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel('Time (s)')
    
    plt.tight_layout()
    return fig

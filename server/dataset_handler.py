"""
Dataset handling functions for OpenBCI EOG data.

Provides utilities for loading, parsing, and segmenting OpenBCI text files.
"""

import numpy as np
import pandas as pd
from pathlib import Path


def load_openbci_txt(filepath, channel=0):
    """
    Load OpenBCI text file and extract data from specified EXG channel.
    
    Parameters:
    -----------
    filepath : str or Path
        Path to OpenBCI .txt file
    channel : int
        EXG channel to extract (0-7). Default: 0
        
    Returns:
    --------
    data : np.ndarray
        1D array of channel data (float64)
    fs : int
        Sampling rate in Hz
    sample_indices : np.ndarray
        Sample indices from the file
    timestamps : np.ndarray
        Timestamps from the file
    """
    filepath = Path(filepath)
    
    # Read the CSV file, skipping comment lines
    df = pd.read_csv(filepath, skiprows=4)
    
    # Strip leading/trailing spaces from column names
    df.columns = df.columns.str.strip()
    
    # Extract channel data
    channel_col = f"EXG Channel {channel}"
    
    if channel_col not in df.columns:
        raise ValueError(f"Channel {channel} not found. Available columns: {df.columns.tolist()}")
    
    data = df[channel_col].values.astype(np.float64)
    sample_indices = df["Sample Index"].values
    
    # Get timestamp info (sampling rate is 250 Hz as per header)
    fs = 250  # OpenBCI GUI standard sampling rate
    
    timestamps = None
    if "Timestamp (Formatted)" in df.columns:
        timestamps = df["Timestamp (Formatted)"].values
    
    print(f"✓ Loaded {len(data)} samples from {filepath.name}")
    print(f"  Channel: EXG Channel {channel}")
    print(f"  Sampling rate: {fs} Hz")
    print(f"  Duration: {len(data)/fs:.2f} seconds")
    
    return data, fs, sample_indices, timestamps


def load_openbci_multiple_channels(filepath, channels=None):
    """
    Load multiple EXG channels from an OpenBCI text file.
    
    Parameters:
    -----------
    filepath : str or Path
        Path to OpenBCI .txt file
    channels : list of int
        EXG channels to extract. Default: None (all channels 0-7)
        
    Returns:
    --------
    data : np.ndarray
        2D array of shape (n_channels, n_samples)
    fs : int
        Sampling rate in Hz
    sample_indices : np.ndarray
        Sample indices from the file
    """
    filepath = Path(filepath)
    
    if channels is None:
        channels = list(range(8))  # All 8 EXG channels
    
    # Read the CSV file
    df = pd.read_csv(filepath, skiprows=4)
    df.columns = df.columns.str.strip()
    
    # Extract all channels
    data_list = []
    for ch in channels:
        channel_col = f"EXG Channel {ch}"
        if channel_col not in df.columns:
            raise ValueError(f"Channel {ch} not found in file")
        data_list.append(df[channel_col].values.astype(np.float64))
    
    data = np.array(data_list)
    sample_indices = df["Sample Index"].values
    fs = 250
    
    print(f"✓ Loaded {len(channels)} channels with {data.shape[1]} samples from {filepath.name}")
    print(f"  Channels: {channels}")
    print(f"  Sampling rate: {fs} Hz")
    print(f"  Duration: {data.shape[1]/fs:.2f} seconds")
    
    return data, fs, sample_indices


def segment_data(data, fs, window_sec=1.0, overlap_sec=0.0):
    """
    Segment continuous data into time windows.
    
    Parameters:
    -----------
    data : np.ndarray
        1D array of signal data (or 2D for multi-channel)
    fs : int
        Sampling rate in Hz
    window_sec : float
        Window length in seconds. Default: 1.0
    overlap_sec : float
        Overlap between windows in seconds. Default: 0.0 (no overlap)
        
    Yields:
    -------
    segment : np.ndarray
        1D array of window data (or 2D for multi-channel)
    start_idx : int
        Start sample index of this window
    end_idx : int
        End sample index of this window
    window_num : int
        Window number (0-indexed)
    """
    window_samples = int(window_sec * fs)
    overlap_samples = int(overlap_sec * fs)
    stride = window_samples - overlap_samples
    
    # Handle both 1D and 2D data
    n_samples = data.shape[-1] if data.ndim > 1 else len(data)
    
    window_num = 0
    for start_idx in range(0, n_samples - window_samples + 1, stride):
        end_idx = start_idx + window_samples
        
        if data.ndim == 1:
            segment = data[start_idx:end_idx]
        else:
            segment = data[:, start_idx:end_idx]
        
        yield segment, start_idx, end_idx, window_num
        window_num += 1


def get_available_channels(filepath):
    """
    List all available EXG channels in an OpenBCI file.
    
    Parameters:
    -----------
    filepath : str or Path
        Path to OpenBCI .txt file
        
    Returns:
    --------
    channels : list of int
        Available channel indices (0-7)
    """
    filepath = Path(filepath)
    df = pd.read_csv(filepath, skiprows=4)
    df.columns = df.columns.str.strip()
    
    channels = []
    for i in range(8):
        if f"EXG Channel {i}" in df.columns:
            channels.append(i)
    
    return channels


def find_openbci_files(directory="."):
    """
    Find all OpenBCI text files in a directory.
    
    Parameters:
    -----------
    directory : str or Path
        Directory to search. Default: current directory
        
    Returns:
    --------
    files : list of Path
        List of OpenBCI .txt files found
    """
    directory = Path(directory)
    files = sorted(directory.glob("*.txt"))
    return files

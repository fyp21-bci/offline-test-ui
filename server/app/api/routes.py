import shutil
import uuid
import os
from pathlib import Path
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from typing import List, Dict, Any
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import numpy as np

from app.core.registry import Registry
from app.models.api import ProcessorInfo, DatasetInfo, RunAnalysisRequest, AnalysisResponse, PlotRequest, ClassificationPlotRequest
from app.core.types import SignalData

# Import specific modules to ensure they register themselves
import app.modules.dataloaders.openbci
import app.modules.processors.tmsi
import app.modules.processors.fft

router = APIRouter()

# Simple storage for this MVP
DATA_DIR = Path("data_store")
DATA_DIR.mkdir(exist_ok=True)

@router.get("/processors", response_model=List[ProcessorInfo])
async def list_processors():
    """List available processing algorithms."""
    return Registry.list_processors()

@router.get("/processors/{name}/config")
async def get_processor_config(name: str):
    """Get the configuration schema for a specific processor."""
    processor_cls = Registry.get_processor(name)
    if not processor_cls:
        raise HTTPException(status_code=404, detail="Processor not found")
    
    # Instantiate or call class method? 
    # Interfaces defined it as instance method, but schema is usually static.
    # Let's instantiate for now as per design.
    processor = processor_cls()
    return processor.get_config_schema()

@router.get("/datasets", response_model=List[DatasetInfo])
async def list_datasets():
    """List uploaded datasets."""
    files = []
    for f in DATA_DIR.glob("*"):
        if f.is_file():
            # In a real app we'd verify it's a valid dataset or use a DB
            files.append(DatasetInfo(
                id=f.name, 
                filename=f.name, 
                size_bytes=f.stat().st_size,
                available_channels=[] # Expensive to calculate every time, skip for list
            ))
    return files

@router.post("/datasets/upload", response_model=DatasetInfo)
async def upload_dataset(file: UploadFile = File(...)):
    """Upload a new dataset file."""
    # Create unique ID to avoid collisions? Or allow overwriting?
    # Keeping filename for simplicity in this MVP
    file_path = DATA_DIR / file.filename
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return DatasetInfo(
        id=file.filename,
        filename=file.filename,
        size_bytes=file_path.stat().st_size,
        available_channels=[]
    )

@router.post("/analysis/run", response_model=AnalysisResponse)
async def run_analysis(request: RunAnalysisRequest):
    """Run a signal processing job."""
    
    # 1. Get Processor
    proc_cls = Registry.get_processor(request.processor_name)
    if not proc_cls:
        raise HTTPException(status_code=404, detail="Processor not found")
    
    # 2. Get Dataset
    file_path = DATA_DIR / request.dataset_id
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    # 3. Find Loader
    loader_cls = Registry.get_dataloader_for_file(str(file_path))
    if not loader_cls:
         raise HTTPException(status_code=400, detail="No suitable data loader found for this file type")
         
    try:
        # Load Data
        loader = loader_cls()
        signal_data: SignalData = loader.load(str(file_path))
        
        # Process
        processor = proc_cls()
        result = processor.process(signal_data, request.config)
        
        return AnalysisResponse(
            processor=proc_cls.name,
            dataset=request.dataset_id,
            result=result.dict()
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/datasets/{dataset_id}/data")
async def get_dataset_data(dataset_id: str, channel_idx: int | None = None):
    """
    Get raw signal data for a dataset.
    
    Parameters:
    - dataset_id: ID of the dataset
    - channel_idx: Optional index of specific channel to retrieve. If None, returns all channels.
    """
    file_path = DATA_DIR / dataset_id
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    loader_cls = Registry.get_dataloader_for_file(str(file_path))
    if not loader_cls:
         raise HTTPException(status_code=400, detail="No suitable data loader found for this file type")
         
    try:
        loader = loader_cls()
        signal_data: SignalData = loader.load(str(file_path))
        
        # Convert numpy array to list for JSON serialization if needed
        import numpy as np
        
        # Get channel names, defaulting to generic names if missing
        channel_names = signal_data.channel_names
        if not channel_names:
            n_channels = len(signal_data.data)
            channel_names = [f"Channel {i}" for i in range(n_channels)]
            
        data_to_return = []
        channels_to_return = []
        
        if channel_idx is not None:
            # Validate index
            if channel_idx < 0 or channel_idx >= len(signal_data.data):
                raise HTTPException(status_code=400, detail=f"Channel index {channel_idx} out of range (0-{len(signal_data.data)-1})")
            
            # Return specific channel
            row = signal_data.data[channel_idx]
            data_to_return = [row.tolist() if isinstance(row, np.ndarray) else row]
            channels_to_return = [channel_names[channel_idx]]
        else:
            # Return all channels
            data_to_return = signal_data.data.tolist() if isinstance(signal_data.data, np.ndarray) else signal_data.data
            channels_to_return = channel_names
        
        return {
            "dataset_id": dataset_id,
            "fs": signal_data.fs,
            "channels": channels_to_return,
            "data": data_to_return
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def _plot_time_domain(
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
        figsize=(12, 2 * len(channel_indices)),
        squeeze=False
    )
    
    for i, ch_idx in enumerate(channel_indices):
        ax = axes[i, 0]
        ax.plot(time_axis, time_slice[ch_idx, :], linewidth=0.8)
        ax.set_ylabel(channel_names[ch_idx])
        ax.grid(True, alpha=0.3)
        
        # Remove x-tick labels for all but bottom subplot
        if i < len(channel_indices) - 1:
            ax.set_xticklabels([])
        else:
            ax.set_xlabel('Time (s)')
    
    plt.tight_layout()
    return fig

def _plot_frequency_domain(
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
        figsize=(12, 2 * len(channel_indices)),
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
        ax.set_xlim(0, 60)  # Limit frequency range to physiological EEG range (0-60Hz)
        ax.grid(True, alpha=0.3)
        
        # Remove x-tick labels for all but bottom subplot
        if i < len(channel_indices) - 1:
            ax.set_xticklabels([])
        else:
            ax.set_xlabel('Frequency (Hz)')
    
    plt.tight_layout()
    return fig


@router.post("/datasets/plot")
async def generate_plot(request: PlotRequest):
    """
    Generate a plot for specified channels and time window.
    
    Parameters:
    - dataset_id: ID of the dataset
    - channels: List of channel indices to plot
    - time_start: Start time in seconds
    - time_end: End time in seconds
    - plot_type: Type of plot ("time" for raw signal, "fft" for frequency spectrum)
    
    Returns a PNG image without titles.
    """
    file_path = DATA_DIR / request.dataset_id
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    loader_cls = Registry.get_dataloader_for_file(str(file_path))
    if not loader_cls:
        raise HTTPException(status_code=400, detail="No suitable data loader found for this file type")
        
    try:
        # Load data
        loader = loader_cls()
        signal_data: SignalData = loader.load(str(file_path))
        
        # Validate channels
        num_channels = len(signal_data.data)
        for ch_idx in request.channels:
            if ch_idx < 0 or ch_idx >= num_channels:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Channel index {ch_idx} out of range (0-{num_channels-1})"
                )
        
        # Convert time to sample indices
        start_sample = int(request.time_start * signal_data.fs)
        end_sample = int(request.time_end * signal_data.fs)
        
        # Validate time window
        data_array = np.array(signal_data.data)
        total_samples = data_array.shape[1]
        
        if start_sample < 0 or end_sample > total_samples:
            raise HTTPException(
                status_code=400,
                detail=f"Time window out of range. Valid range: 0 to {total_samples/signal_data.fs:.2f}s"
            )
        
        if start_sample >= end_sample:
            raise HTTPException(
                status_code=400,
                detail="time_start must be less than time_end"
            )
        
        # Extract time window
        time_slice = data_array[:, start_sample:end_sample]
        
        # Get channel names
        channel_names = signal_data.channel_names
        if not channel_names:
            channel_names = [f"Channel {i}" for i in range(num_channels)]
        
        # Generate plot based on type
        if request.plot_type == "time":
            time_axis = np.arange(start_sample, end_sample) / signal_data.fs
            fig = _plot_time_domain(time_slice, time_axis, request.channels, channel_names)
        elif request.plot_type == "fft":
            fig = _plot_frequency_domain(time_slice, signal_data.fs, request.channels, channel_names)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid plot_type: {request.plot_type}")
        
        # Save to BytesIO buffer
        buf = BytesIO()
        plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        plt.close(fig)  # Clean up
        
        buf.seek(0)
        
        return Response(content=buf.getvalue(), media_type="image/png")
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _plot_classification(
    signal_data: SignalData,
    classification_results: List[Dict[str, Any]],
    time_start: float,
    time_end: float,
    channel_indices: List[int],
    channel_names: List[str],
    target_frequencies: set[float] = None
) -> plt.Figure:
    """
    Generate a classification plot with color-coded backgrounds.
    
    Args:
        signal_data: Full signal data
        classification_results: List of classification results for each sub-window
        time_start: Start time in seconds
        time_end: End time in seconds
        channel_indices: List of channel indices to plot
        channel_names: List of all channel names
        target_frequencies: Optional set of target frequencies for correctness evaluation
    
    Returns:
        matplotlib Figure object
    """
    fs = signal_data.fs
    data_array = np.array(signal_data.data)
    
    fig, axes = plt.subplots(
        len(channel_indices), 
        1, 
        figsize=(12, 2 * len(channel_indices)),
        squeeze=False
    )
    
    for i, ch_idx in enumerate(channel_indices):
        ax = axes[i, 0]
        
        # Plot each sub-window with its averaged signal and colored background
        for result in classification_results:
            start_time = result['start_time']
            end_time = result['end_time']
            best_freq = result['best_frequency']
            
            # Convert to sample indices
            start_sample = int(start_time * fs)
            end_sample = int(end_time * fs)
            
            # Extract sub-window signal
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
            ax.set_xticklabels([])
        else:
            ax.set_xlabel('Time (s)')
    
    plt.tight_layout()
    return fig


@router.post("/datasets/plot-classification")
async def generate_classification_plot(request: ClassificationPlotRequest):
    """
    Generate a classification plot with color-coded segments.
    
    Parameters:
    - dataset_id: ID of the dataset
    - channels: List of channel indices to plot
    - time_start: Start time in seconds
    - time_end: End time in seconds
    - processor_name: Name of classification processor
    - processor_config: Configuration including window_sec, frequencies, n_harmonics
    - target_frequency: Optional target frequency (or list/string) for correctness evaluation
    
    Returns a PNG image with color-coded backgrounds and JSON metadata.
    """
    file_path = DATA_DIR / request.dataset_id
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    loader_cls = Registry.get_dataloader_for_file(str(file_path))
    if not loader_cls:
        raise HTTPException(status_code=400, detail="No suitable data loader found for this file type")
        
    try:
        # Load data
        loader = loader_cls()
        signal_data: SignalData = loader.load(str(file_path))
        
        # Validate channels
        num_channels = len(signal_data.data)
        for ch_idx in request.channels:
            if ch_idx < 0 or ch_idx >= num_channels:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Channel index {ch_idx} out of range (0-{num_channels-1})"
                )
        
        # Validate time window
        data_array = np.array(signal_data.data)
        total_samples = data_array.shape[1]
        total_duration = total_samples / signal_data.fs
        
        if request.time_start < 0 or request.time_end > total_duration:
            raise HTTPException(
                status_code=400,
                detail=f"Time window out of range. Valid range: 0 to {total_duration:.2f}s"
            )
        
        if request.time_start >= request.time_end:
            raise HTTPException(
                status_code=400,
                detail="time_start must be less than time_end"
            )
        
        # Get processor
        proc_cls = Registry.get_processor(request.processor_name)
        if not proc_cls:
            raise HTTPException(status_code=404, detail="Processor not found")
        
        # Extract time window and channels for processing
        start_sample = int(request.time_start * signal_data.fs)
        end_sample = int(request.time_end * signal_data.fs)
        
        # Select data for requested channels
        channel_indices = request.channels
        selected_data = data_array[channel_indices, start_sample:end_sample]
        
        # Get selected channel names
        all_channel_names = signal_data.channel_names if signal_data.channel_names else [f"Channel {i}" for i in range(num_channels)]
        selected_channel_names = [all_channel_names[i] for i in channel_indices]
        
        # Create a windowed SignalData object with ONLY selected channels
        windowed_data = SignalData(
            data=selected_data.tolist(),
            fs=signal_data.fs,
            channel_names=selected_channel_names
        )
        
        # Process with classification algorithm
        processor = proc_cls()
        result = processor.process(windowed_data, request.processor_config)
        
        # Extract classification results
        classification_results = result.data.get('results', [])
        
        # Adjust times to be relative to the full dataset
        for res in classification_results:
            res['start_time'] += request.time_start
            res['end_time'] += request.time_start
        
        # Parse target frequencies
        target_frequencies = set()
        if request.target_frequency is not None:
            if isinstance(request.target_frequency, float) or isinstance(request.target_frequency, int):
                target_frequencies.add(float(request.target_frequency))
            elif isinstance(request.target_frequency, list):
                target_frequencies.update(float(f) for f in request.target_frequency)
            elif isinstance(request.target_frequency, str):
                # Handle comma-separated string
                parts = request.target_frequency.split(',')
                for p in parts:
                    try:
                        target_frequencies.add(float(p.strip()))
                    except ValueError:
                        pass # Ignore invalid numbers
        
        # Calculate segment counts per frequency
        frequency_counts = {}
        correct_count = 0
        incorrect_count = 0
        
        for res in classification_results:
            freq = res['best_frequency']
            frequency_counts[freq] = frequency_counts.get(freq, 0) + 1
            
            if target_frequencies:
                is_correct = any(abs(freq - tf) < 0.01 for tf in target_frequencies)
                if is_correct:
                    correct_count += 1
                else:
                    incorrect_count += 1
        
        # Get channel names
        channel_names = signal_data.channel_names
        if not channel_names:
            channel_names = [f"Channel {i}" for i in range(num_channels)]
        
        # Generate plot
        fig = _plot_classification(
            signal_data,
            classification_results,
            request.time_start,
            request.time_end,
            request.channels,
            channel_names,
            target_frequencies if target_frequencies else None
        )
        
        # Save to BytesIO buffer
        buf = BytesIO()
        plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        plt.close(fig)
        buf.seek(0)
        
        # Prepare metadata
        metadata = {
            "total_segments": len(classification_results),
            "frequency_counts": frequency_counts,
        }
        
        if target_frequencies:
            metadata["target_frequencies"] = list(target_frequencies)
            metadata["correct_count"] = correct_count
            metadata["incorrect_count"] = incorrect_count
            metadata["accuracy"] = correct_count / len(classification_results) if classification_results else 0
        
        # Return both image and metadata
        # We'll return the image directly and include metadata in headers
        from fastapi.responses import JSONResponse
        import base64
        
        # Encode image as base64
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        return JSONResponse(content={
            "image": f"data:image/png;base64,{image_base64}",
            "metadata": metadata
        })
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

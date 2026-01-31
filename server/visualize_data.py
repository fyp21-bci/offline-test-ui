
import os
import argparse
import matplotlib
# Try to use an interactive backend if available
try:
    import tkinter
    matplotlib.use('TkAgg')
except ImportError:
    pass
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path
from dataset_handler import load_openbci_multiple_channels

def visualize_file(filepath: str, channels_to_plot=None):
    """
    Load and visualize OpenBCI data using matplotlib.
    """
    print(f"Loading file: {filepath}")
    
    try:
        data, fs, sample_indices = load_openbci_multiple_channels(filepath)
        
        # OpenBCI Cyton Scale Factor
        # Vref = 4.5V, Gain = 24, 24-bit signed integer
        scale_factor_uv = 4.5 / 24 / (2**23 - 1) * 1000000
        print(f"Applying Cyton scale factor: {scale_factor_uv:.8f} uV/count")
        data = data * scale_factor_uv
        
    except Exception as e:
        print(f"Error loading file: {e}")
        return

    n_channels = data.shape[0]
    n_samples = data.shape[1]
    time = np.arange(n_samples) / fs

    if channels_to_plot is None:
        channels_to_plot = range(n_channels)
    
    print(f"Plotting {len(channels_to_plot)} channels...")
    
    fig, axes = plt.subplots(len(channels_to_plot), 1, figsize=(12, 2 * len(channels_to_plot)), sharex=True)
    if len(channels_to_plot) == 1:
        axes = [axes]
    
    for i, ch_idx in enumerate(channels_to_plot):
        if ch_idx >= n_channels:
            print(f"Warning: Channel {ch_idx} not found in data. Skipping.")
            continue
            
        ax = axes[i]
        ax.plot(time, data[ch_idx], linewidth=0.5)
        ax.set_ylabel(f'Ch {ch_idx} (μV)')
        ax.grid(True, alpha=0.3)
        
        # Remove top and right spines for cleaner look
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)

    axes[-1].set_xlabel('Time (s)')
    plt.suptitle(f'OpenBCI Data Visualization: {Path(filepath).name}', fontsize=16)
    plt.tight_layout()

    # Check backend and handle output
    backend = matplotlib.get_backend().lower()
    print(f"Matplotlib backend: {backend}")

    if backend == 'agg' or backend == 'cairo' or backend == 'ps' or backend == 'pdf' or backend == 'svg':
        output_file = Path(filepath).with_suffix('.png').name
        print(f"Non-interactive backend detected. Saving plot to {output_file}")
        plt.savefig(output_file)
    else:
        try:
            plt.show()
        except Exception as e:
            print(f"Warning: Failed to show plot ({e}). Saving to file instead.")
            output_file = Path(filepath).with_suffix('.png').name
            plt.savefig(output_file)
            print(f"Saved plot to {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Visualize OpenBCI raw data")
    parser.add_argument("file", nargs="?", help="Path to OpenBCI .txt file")
    parser.add_argument("--channels", nargs="+", type=int, help="Specific channels to plot (e.g., 0 1 2)")
    
    args = parser.parse_args()
    
    target_file = args.file
    
    # helper: find first file in data_store if no file provided
    if not target_file:
        data_store = Path("data_store")
        if data_store.exists():
            files = list(data_store.glob("*.txt"))
            if files:
                target_file = str(files[0])
                print(f"No file specified. Using found valid file: {target_file}")
            else:
                print("No .txt files found in data_store/ and no file argument provided.")
                exit(1)
        else:
             print("data_store/ directory not found and no file argument provided.")
             exit(1)

    visualize_file(target_file, args.channels)

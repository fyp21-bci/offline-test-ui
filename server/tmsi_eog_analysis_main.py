"""
Main TMSI EOG Analysis Pipeline

This module orchestrates the complete analysis workflow:
- Data loading
- Signal segmentation
- TMSI classification
- Results visualization
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
import warnings

from dataset_handler import load_openbci_txt, segment_data, find_openbci_files
from tmsi_core import TMSIClassifier

warnings.filterwarnings('ignore')


# ============================================================================
# VISUALIZATION FUNCTIONS
# ============================================================================

def plot_classification_results(results_list, freq_1, freq_2, fs=250, window_sec=1.0):
    """
    Plot TMSI classification results over time.
    
    Parameters:
    -----------
    results_list : list of dict
        Results from classify_continuous
    freq_1 : float
        First frequency
    freq_2 : float
        Second frequency
    fs : int
        Sampling rate
    window_sec : float
        Window length in seconds
    """
    n_windows = len(results_list)
    time_per_window = window_sec
    times = np.arange(n_windows) * time_per_window
    
    scores_1 = [r['freq_1_score'] for r in results_list]
    scores_2 = [r['freq_2_score'] for r in results_list]
    classifications = [r['classification'] for r in results_list]
    confidences = [r['confidence'] for r in results_list]
    
    fig, axes = plt.subplots(3, 1, figsize=(14, 10))
    
    # Plot 1: TMSI Scores
    ax = axes[0]
    ax.plot(times, scores_1, 'b-o', label=f'Freq {freq_1:.1f} Hz', alpha=0.7)
    ax.plot(times, scores_2, 'r-o', label=f'Freq {freq_2:.1f} Hz', alpha=0.7)
    ax.set_xlabel('Time (s)')
    ax.set_ylabel('TMSI Score')
    ax.set_title('TMSI Scores Over Time')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    # Plot 2: Classification
    ax = axes[1]
    colors = ['blue' if c == 'freq_1' else 'red' for c in classifications]
    ax.scatter(times, [1]*n_windows, c=colors, s=100, alpha=0.6)
    ax.axhline(1, color='gray', linestyle='--', alpha=0.3)
    ax.set_ylim(0.5, 1.5)
    ax.set_ylabel('Classification')
    ax.set_xlabel('Time (s)')
    ax.set_yticks([])
    ax.set_title(f'Classification: Blue={freq_1:.1f}Hz, Red={freq_2:.1f}Hz')
    ax.grid(True, alpha=0.3)
    
    # Plot 3: Confidence
    ax = axes[2]
    ax.plot(times, confidences, 'g-o', alpha=0.7)
    ax.fill_between(times, confidences, alpha=0.3, color='green')
    ax.set_xlabel('Time (s)')
    ax.set_ylabel('Confidence (|ΔScore|)')
    ax.set_title('Classification Confidence')
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    return fig


def plot_signal_and_classification(data, results_list, freq_1, freq_2, fs=250, window_sec=1.0):
    """
    Plot raw signal alongside classification results.
    
    Parameters:
    -----------
    data : np.ndarray
        Raw signal data
    results_list : list of dict
        Results from classify_continuous
    freq_1 : float
        First frequency
    freq_2 : float
        Second frequency
    fs : int
        Sampling rate
    window_sec : float
        Window length in seconds
    """
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8))
    
    # Plot raw signal
    time = np.arange(len(data)) / fs
    ax1.plot(time, data, 'k-', alpha=0.7, linewidth=0.5)
    ax1.set_ylabel('Signal Amplitude (μV)')
    ax1.set_title('Raw EOG Signal (Channel 0)')
    ax1.grid(True, alpha=0.3)
    
    # Plot classification overlay
    n_windows = len(results_list)
    time_per_window = window_sec
    times = np.arange(n_windows) * time_per_window
    classifications = [r['classification'] for r in results_list]
    colors = ['blue' if c == 'freq_1' else 'red' for c in classifications]
    
    # Create colorful background regions
    for i, (t, color) in enumerate(zip(times, colors)):
        ax1.axvspan(t, t + window_sec, alpha=0.1, color=color)
    
    ax2.scatter(times, [1]*n_windows, c=colors, s=100, alpha=0.6)
    ax2.set_ylim(0.5, 1.5)
    ax2.set_xlabel('Time (s)')
    ax2.set_ylabel('Classification')
    ax2.set_yticks([])
    ax2.set_title(f'Classification: Blue={freq_1:.1f}Hz, Red={freq_2:.1f}Hz')
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    return fig


# ============================================================================
# MAIN ANALYSIS FUNCTION
# ============================================================================

def analyze_eog_file(filepath, freq_1, freq_2, channel=0, window_sec=1.0, 
                     overlap_sec=0.0, n_harmonics=5, plot=True):
    """
    Complete TMSI analysis pipeline for OpenBCI EOG file.
    
    Parameters:
    -----------
    filepath : str or Path
        Path to OpenBCI .txt file
    freq_1 : float
        First candidate frequency in Hz
    freq_2 : float
        Second candidate frequency in Hz
    channel : int
        EXG channel to analyze. Default: 0
    window_sec : float
        Window length in seconds. Default: 1.0
    overlap_sec : float
        Window overlap in seconds. Default: 0.0
    n_harmonics : int
        Number of harmonics. Default: 5
    plot : bool
        Whether to generate plots. Default: True
        
    Returns:
    --------
    results_df : pd.DataFrame
        Results for each window
    classifier : TMSIClassifier
        Trained classifier object
    raw_data : np.ndarray
        Raw signal data
    """
    print("\n" + "="*70)
    print(f"TMSI EOG Analysis: {freq_1:.1f}Hz vs {freq_2:.1f}Hz")
    print("="*70)
    
    # Load data
    print("\n[1/4] Loading data...")
    data, fs, sample_indices, timestamps = load_openbci_txt(filepath, channel=channel)
    
    # Initialize classifier
    print("\n[2/4] Initializing TMSI classifier...")
    classifier = TMSIClassifier(freq_1, freq_2, fs=fs, n_harmonics=n_harmonics, 
                                window_sec=window_sec)
    print(f"  Window length: {window_sec}s ({int(window_sec*fs)} samples)")
    print(f"  Window overlap: {overlap_sec}s ({int(overlap_sec*fs)} samples)")
    print(f"  Laplacian neighborhood: 25 samples (~0.1s)")
    
    # Classify windows
    print("\n[3/4] Classifying signal windows...")
    results_list = []
    window_count = 0
    
    for result, window_num, start_idx, end_idx in classifier.classify_continuous(
        data, overlap_sec=overlap_sec
    ):
        results_list.append({
            'window': window_num,
            'start_sample': start_idx,
            'end_sample': end_idx,
            'start_time': start_idx / fs,
            'end_time': end_idx / fs,
            'freq_1_score': result['freq_1'],
            'freq_2_score': result['freq_2'],
            'classification': result['classification'],
            'confidence': result['confidence'],
            'score_ratio': result['score_ratio']
        })
        window_count += 1
    
    print(f"  ✓ Classified {window_count} windows")
    
    # Create results dataframe
    results_df = pd.DataFrame(results_list)
    
    # Print summary statistics
    print("\n[4/4] Summary Statistics:")
    print("-" * 70)
    freq_1_count = (results_df['classification'] == 'freq_1').sum()
    freq_2_count = (results_df['classification'] == 'freq_2').sum()
    freq_1_pct = 100 * freq_1_count / len(results_df)
    freq_2_pct = 100 * freq_2_count / len(results_df)
    
    print(f"  Total windows: {len(results_df)}")
    print(f"  Classified as {freq_1:.1f}Hz: {freq_1_count} ({freq_1_pct:.1f}%)")
    print(f"  Classified as {freq_2:.1f}Hz: {freq_2_count} ({freq_2_pct:.1f}%)")
    print(f"  Mean confidence: {results_df['confidence'].mean():.4f}")
    print(f"  Std confidence: {results_df['confidence'].std():.4f}")
    print(f"  Mean score ratio: {results_df['score_ratio'].mean():.4f}")
    
    # Plot results
    if plot:
        print("\n[5/5] Generating plots...")
        fig1 = plot_classification_results(results_list, freq_1, freq_2, fs, window_sec)
        fig2 = plot_signal_and_classification(data, results_list, freq_1, freq_2, fs, window_sec)
        plt.show()
    
    print("\n" + "="*70)
    print("Analysis complete!")
    print("="*70 + "\n")
    
    return results_df, classifier, data


# ============================================================================
# BATCH ANALYSIS
# ============================================================================

def batch_analyze_directory(directory, freq_1, freq_2, channel=0, window_sec=1.0, 
                           overlap_sec=0.0, n_harmonics=5, plot=False):
    """
    Analyze all OpenBCI text files in a directory.
    
    Parameters:
    -----------
    directory : str or Path
        Directory containing OpenBCI .txt files
    freq_1 : float
        First candidate frequency in Hz
    freq_2 : float
        Second candidate frequency in Hz
    channel : int
        EXG channel to analyze. Default: 0
    window_sec : float
        Window length in seconds. Default: 1.0
    overlap_sec : float
        Window overlap in seconds. Default: 0.0
    n_harmonics : int
        Number of harmonics. Default: 5
    plot : bool
        Whether to generate plots. Default: False
        
    Returns:
    --------
    results_dict : dict
        Dictionary mapping filenames to results
    """
    directory = Path(directory)
    files = find_openbci_files(directory)
    
    print(f"\nFound {len(files)} OpenBCI files in {directory}")
    
    results_dict = {}
    for i, filepath in enumerate(files, 1):
        print(f"\n[{i}/{len(files)}] Analyzing {filepath.name}...")
        try:
            results_df, classifier, raw_data = analyze_eog_file(
                filepath, freq_1, freq_2, channel=channel, window_sec=window_sec,
                overlap_sec=overlap_sec, n_harmonics=n_harmonics, plot=plot
            )
            results_dict[filepath.name] = {
                'df': results_df,
                'classifier': classifier,
                'data': raw_data
            }
        except Exception as e:
            print(f"  ✗ Error analyzing {filepath.name}: {str(e)}")
    
    return results_dict


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    """
    Example usage of TMSI analysis on OpenBCI EOG data.
    
    To use this script:
    1. Place OpenBCI .txt files in a 'data/' subdirectory
    2. Run: python tmsi_eog_analysis.py
    3. Adjust parameters as needed (freq_1, freq_2, window_sec, etc.)
    """
    
    data_dir = Path("data")
    
    # Find available text files
    txt_files = find_openbci_files(data_dir)
    
    if txt_files:
        filepath = txt_files[2]
        print(f"Found file: {filepath}")
        
        # Run analysis with custom parameters
        results_df, classifier, raw_data = analyze_eog_file(
            filepath,
            freq_1=23.0,      # First candidate frequency (Hz)
            freq_2=7.0,     # Second candidate frequency (Hz)
            channel=3,       # EXG Channel 0
            window_sec=5.0,  # 2-second windows - ADJUST THIS!
            overlap_sec=0.5, # 0.5s overlap
            n_harmonics=5,   # Use 5 harmonics
            plot=True        # Show plots
        )
        
        # Save results to CSV
        output_file = filepath.parent / f"{filepath.stem}_tmsi_results.csv"
        results_df.to_csv(output_file, index=False)
        print(f"✓ Results saved to: {output_file}")
        
        # Optional: Analyze all files in directory
        # results_dict = batch_analyze_directory(
        #     data_dir, freq_1=8.0, freq_2=12.0, window_sec=2.0, plot=False
        # )
    else:
        print("No .txt files found in data/ directory")

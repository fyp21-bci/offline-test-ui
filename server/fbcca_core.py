"""
FBCCA (Filter Bank Canonical Correlation Analysis) core functions.

Implements the FBCCA algorithm for frequency detection and classification.
"""

import numpy as np
from scipy.signal import butter, filtfilt
from sklearn.cross_decomposition import CCA

# ============================================================================
# Reference Signal Generation
# ============================================================================

def build_reference(f, fs, n_samples, n_harmonics=5):
    """
    Build reference signal with sinusoids and cosinusoids.
    
    Parameters:
    -----------
    f : float
        Frequency in Hz
    fs : int
        Sampling rate in Hz
    n_samples : int
        Number of samples
    n_harmonics : int
        Number of harmonics to use. Default: 5
        
    Returns:
    --------
    Y : np.ndarray
        Reference matrix of shape (2*n_harmonics, n_samples)
    """
    t = np.arange(n_samples) / fs
    Y = []
    for h in range(1, n_harmonics + 1):
        Y.append(np.sin(2 * np.pi * h * f * t))
        Y.append(np.cos(2 * np.pi * h * f * t))
    return np.array(Y)

# ============================================================================
# Filter Bank
# ============================================================================

def bandpass_filter(X, fs, low, high, order=4):
    """
    Apply bandpass filter to signal.
    
    Parameters:
    -----------
    X : np.ndarray
        Signal data (n_channels, n_samples)
    fs : int
        Sampling rate
    low : float
        Low cutoff frequency
    high : float
        High cutoff frequency
    order : int
        Filter order
        
    Returns:
    --------
    X_filtered : np.ndarray
        Filtered signal
    """
    nyq = fs / 2
    b, a = butter(order, [low/nyq, high/nyq], btype="bandpass")
    return filtfilt(b, a, X, axis=-1)

def build_filterbank(n_subbands=10, f_low=8, f_high=88):
    """
    Build filter bank subbands.
    
    Parameters:
    -----------
    n_subbands : int
        Number of subbands
    f_low : float
        Lower frequency bound
    f_high : float
        Upper frequency bound
        
    Returns:
    --------
    subbands : list of tuples
        List of (low, high) frequency tuples
    """
    return [(m*f_low, f_high) for m in range(1, n_subbands+1)]

# ============================================================================
# CCA and FBCCA Scoring
# ============================================================================

def cca_corr(X, Y):
    """
    Calculate canonical correlation coefficient.
    
    Parameters:
    -----------
    X : np.ndarray
        Signal matrix (n_channels, n_samples)
    Y : np.ndarray
        Reference matrix (2*n_harmonics, n_samples)
        
    Returns:
    --------
    rho : float
        Canonical correlation coefficient
    """
    cca = CCA(n_components=1, max_iter=1000)
    # sklearn CCA expects (n_samples, n_features)
    cca.fit(X.T, Y.T)
    Xc, Yc = cca.transform(X.T, Y.T)
    return np.corrcoef(Xc[:,0], Yc[:,0])[0,1]

def fbcca_score_for_frequency(X, f, fs, n_harmonics=5, n_subbands=5):
    """
    Compute FBCCA score for a single frequency.
    
    Parameters:
    -----------
    X : np.ndarray
        Signal data (n_channels, n_samples)
    f : float
        Target frequency
    fs : int
        Sampling rate
    n_harmonics : int
        Number of harmonics
    n_subbands : int
        Number of subbands
        
    Returns:
    --------
    score : float
        Weighted FBCCA score
    """
    n_samples = X.shape[1]
    Y = build_reference(f, fs, n_samples, n_harmonics)
    
    # Subbands configuration
    # Standard implementation uses:
    # Band m: passband (m*8 Hz, 88 Hz)
    # But usually limited to Nyquist. 
    # Let's use a simpler fixed range or the one from user request.
    # User request: [(m*f_low, f_high) for m in range(1, n_subbands+1)] with f_low=8, f_high=88
    # However, if fs=250, Nyquist is 125. 88 is fine.
    
    subbands = build_filterbank(n_subbands=n_subbands)
    score = 0.0
    
    # Weights: w(n) = n^(-1.25) + 0.25
    a = 1.25
    b = 0.25
    
    for m, (low, high) in enumerate(subbands, start=1):
        if low >= high: 
            continue # Skip invalid bands
            
        try:
            Xf = bandpass_filter(X, fs, low, high)
            rho = cca_corr(Xf, Y)
            w = (m ** (-a)) + b
            score += w * (rho ** 2)
        except Exception:
            # Safe fallback if filter fails (e.g. strict bounds)
            pass
            
    return score

def fbcca_score_multiple_frequencies(signal, frequencies, fs, n_harmonics=5, n_subbands=5):
    """
    Compute FBCCA scores for multiple frequencies.
    
    Parameters:
    -----------
    signal : np.ndarray
        Signal data (n_channels, n_samples)
    frequencies : list
        List of target frequencies
    fs : int
        Sampling rate
    n_harmonics : int
        Number of harmonics
    n_subbands : int
        Number of subbands
        
    Returns:
    --------
    scores : np.ndarray
        Scores for each frequency
    """
    scores = np.zeros(len(frequencies))
    for i, f in enumerate(frequencies):
        scores[i] = fbcca_score_for_frequency(signal, f, fs, n_harmonics, n_subbands)
    return scores

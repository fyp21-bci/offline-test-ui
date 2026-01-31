"""
TMSI (Temporally Local Synchronization Index) core functions.

Implements the TMSI algorithm for frequency detection and classification.
Based on: "Temporally Local Synchronization Index for EEG Analysis"
"""

import numpy as np


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
# Graph-based Temporal Locality
# ============================================================================

def build_weight_matrix(M, s=25, r=3):
    """
    Build temporal locality weight matrix.
    
    Uses a power law decay based on temporal distance.
    
    Parameters:
    -----------
    M : int
        Number of samples
    s : int
        Neighborhood range in samples. Default: 25 (~0.1s at 250Hz)
    r : int
        Shape parameter. Default: 3
        
    Returns:
    --------
    W : np.ndarray
        Weight matrix of shape (M, M)
    """
    idx = np.arange(M)
    dist = np.abs(idx[:, None] - idx[None, :])
    m = dist / s
    
    W = np.zeros((M, M), dtype=np.float64)
    mask = (m < 1)
    W[mask] = (1 - np.abs(m[mask]) ** r) ** r
    return W


def laplacian_from_W(W):
    """
    Compute graph Laplacian from weight matrix.
    
    L = D - W (normalized graph Laplacian)
    
    Parameters:
    -----------
    W : np.ndarray
        Weight matrix
        
    Returns:
    --------
    L : np.ndarray
        Laplacian matrix (D - W)
    """
    D = np.diag(W.sum(axis=1))
    return D - W


# ============================================================================
# Covariance and Whitening
# ============================================================================

def temporally_local_covariance(Z, L):
    """
    Compute temporally local covariance matrix.
    
    Incorporates temporal locality via Laplacian weighting:
    C = (Z @ L @ Z.T) / M
    
    Parameters:
    -----------
    Z : np.ndarray
        Stacked matrix [EEG; Reference], shape (n_channels, n_samples)
    L : np.ndarray
        Laplacian matrix
        
    Returns:
    --------
    C : np.ndarray
        Covariance matrix
    """
    M = Z.shape[1]
    return (Z @ L @ Z.T) / M


def inv_sqrtm(A, eps=1e-10):
    """
    Compute inverse square root of symmetric matrix.
    
    A^{-1/2} using eigendecomposition: A = V @ Λ @ V.T
    A^{-1/2} = V @ Λ^{-1/2} @ V.T
    
    Parameters:
    -----------
    A : np.ndarray
        Symmetric positive semi-definite matrix
    eps : float
        Regularization parameter. Default: 1e-10
        
    Returns:
    --------
    A_inv_sqrt : np.ndarray
        Inverse square root of A
    """
    vals, vecs = np.linalg.eigh(A)
    vals = np.maximum(vals, eps)
    return vecs @ np.diag(1.0 / np.sqrt(vals)) @ vecs.T


def compute_R_from_C(C, n_eeg=1):
    """
    Compute whitened correlation matrix R.
    
    Applies canonical correlation analysis (CCA) whitening:
    U = block_diag(C11^{-1/2}, C22^{-1/2})
    R = U @ C @ U.T
    
    Parameters:
    -----------
    C : np.ndarray
        Covariance matrix
    n_eeg : int
        Number of EEG channels. Default: 1 (for single-channel EOG)
        
    Returns:
    --------
    R : np.ndarray
        Whitened correlation matrix
    """
    C11 = C[:n_eeg, :n_eeg]
    C22 = C[n_eeg:, n_eeg:]
    
    C11_inv_sqrt = inv_sqrtm(C11)
    C22_inv_sqrt = inv_sqrtm(C22)
    
    top = np.hstack([C11_inv_sqrt, np.zeros((C11.shape[0], C22.shape[0]))])
    bot = np.hstack([np.zeros((C22.shape[0], C11.shape[0])), C22_inv_sqrt])
    U = np.vstack([top, bot])
    
    R = U @ C @ U.T
    return R


# ============================================================================
# Synchronization Index
# ============================================================================

def synchronization_index(lam):
    """
    Compute synchronization index from eigenvalues.
    
    S = 1 + (Σ λ_i * log(λ_i)) / log(P)
    
    Measures the uniformity of eigenvalue distribution.
    Higher S indicates stronger synchronization.
    
    Parameters:
    -----------
    lam : np.ndarray
        Normalized eigenvalues
        
    Returns:
    --------
    S : float
        Synchronization index score
    """
    P = len(lam)
    return 1 + (np.sum(lam * np.log(lam + 1e-12))) / np.log(P)


def score_from_C(C, n_eeg=1):
    """
    Compute TMSI score from covariance matrix.
    
    Complete pipeline:
    1. Compute whitened correlation matrix R
    2. Extract eigenvalues
    3. Normalize eigenvalues
    4. Compute synchronization index
    
    Parameters:
    -----------
    C : np.ndarray
        Covariance matrix
    n_eeg : int
        Number of EEG channels. Default: 1
        
    Returns:
    --------
    score : float
        TMSI synchronization score
    """
    R = compute_R_from_C(C, n_eeg)
    eigvals = np.linalg.eigvalsh(R)
    eigvals = np.maximum(eigvals, 1e-12)
    lam = eigvals / np.sum(eigvals)
    return synchronization_index(lam)


# ============================================================================
# TMSI Scoring
# ============================================================================

def tmsi_score_for_frequency(signal, freq, fs, L, n_harmonics=5, n_eeg=1):
    """
    Compute TMSI score for a single frequency.
    
    Complete analysis pipeline:
    1. Build reference signals (harmonics)
    2. Stack signal with reference
    3. Compute temporally local covariance
    4. Compute synchronization index
    
    Parameters:
    -----------
    signal : np.ndarray
        1D signal data
    freq : float
        Frequency in Hz
    fs : int
        Sampling rate in Hz
    L : np.ndarray
        Laplacian matrix
    n_harmonics : int
        Number of harmonics. Default: 5
    n_eeg : int
        Number of EEG channels. Default: 1
        
    Returns:
    --------
    score : float
        TMSI score for this frequency
    """
    n_samples = signal.shape[-1] if signal.ndim > 1 else len(signal)
    Y = build_reference(freq, fs, n_samples, n_harmonics)
    
    # For single-channel, X is (1, n_samples)
    if signal.ndim == 1:
        X = signal.reshape(1, -1)
    else:
        X = signal
    
    Z = np.vstack([X, Y])
    C = temporally_local_covariance(Z, L)
    return score_from_C(C, n_eeg=X.shape[0])


def tmsi_score_multiple_frequencies(signal, frequencies, fs, L, n_harmonics=5, n_eeg=1):
    """
    Compute TMSI scores for multiple candidate frequencies.
    
    Parameters:
    -----------
    signal : np.ndarray
        1D signal data
    frequencies : list or array of float
        Candidate frequencies in Hz
    fs : int
        Sampling rate in Hz
    L : np.ndarray
        Laplacian matrix
    n_harmonics : int
        Number of harmonics. Default: 5
    n_eeg : int
        Number of EEG channels. Default: 1
        
    Returns:
    --------
    scores : np.ndarray
        TMSI scores for each frequency
    """
    scores = np.zeros(len(frequencies), dtype=np.float64)
    for i, f in enumerate(frequencies):
        scores[i] = tmsi_score_for_frequency(signal, f, fs, L, n_harmonics, n_eeg)
    return scores


# ============================================================================
# TMSI Classifier
# ============================================================================

class TMSIClassifier:
    """
    TMSI-based frequency classifier for EOG/EEG signals.
    
    Classifies signal as correlated with freq_1 or freq_2 using TMSI scores.
    """
    
    def __init__(self, freq_1, freq_2, fs=250, n_harmonics=5, window_sec=1.0):
        """
        Initialize classifier.
        
        Parameters:
        -----------
        freq_1 : float
            First candidate frequency in Hz
        freq_2 : float
            Second candidate frequency in Hz
        fs : int
            Sampling rate in Hz. Default: 250
        n_harmonics : int
            Number of harmonics for reference. Default: 5
        window_sec : float
            Window length in seconds. Default: 1.0
        """
        self.freq_1 = freq_1
        self.freq_2 = freq_2
        self.fs = fs
        self.n_harmonics = n_harmonics
        self.window_sec = window_sec
        
        # Build weight matrix and Laplacian once
        window_samples = int(window_sec * fs)
        s_local = 25  # ~0.1s neighborhood
        r = 3
        
        W = build_weight_matrix(window_samples, s=s_local, r=r)
        self.L = laplacian_from_W(W)
    
    def classify_window(self, signal_window):
        """
        Classify a single time window.
        
        Parameters:
        -----------
        signal_window : np.ndarray
            1D signal window
            
        Returns:
        --------
        result : dict
            Dictionary with keys:
            - 'freq_1': TMSI score for freq_1
            - 'freq_2': TMSI score for freq_2
            - 'classification': 'freq_1' or 'freq_2' (higher score)
            - 'confidence': Difference between scores (higher = more confident)
            - 'score_ratio': score_1 / score_2
        """
        score_1 = tmsi_score_for_frequency(
            signal_window, self.freq_1, self.fs, self.L, 
            n_harmonics=self.n_harmonics, n_eeg=1
        )
        score_2 = tmsi_score_for_frequency(
            signal_window, self.freq_2, self.fs, self.L,
            n_harmonics=self.n_harmonics, n_eeg=1
        )
        
        classification = 'freq_1' if score_1 > score_2 else 'freq_2'
        confidence = abs(score_1 - score_2)
        score_ratio = score_1 / (score_2 + 1e-12)
        
        return {
            'freq_1': float(score_1),
            'freq_2': float(score_2),
            'classification': classification,
            'confidence': float(confidence),
            'score_ratio': float(score_ratio)
        }
    
    def classify_continuous(self, signal, overlap_sec=0.0):
        """
        Classify continuous signal in time windows.
        
        Parameters:
        -----------
        signal : np.ndarray
            1D continuous signal
        overlap_sec : float
            Overlap between windows in seconds. Default: 0.0
            
        Yields:
        -------
        result : dict
            Classification result for each window (see classify_window)
        window_num : int
            Window number (0-indexed)
        start_idx : int
            Start sample index
        end_idx : int
            End sample index
        """
        from dataset_handler import segment_data
        
        for window, start_idx, end_idx, window_num in segment_data(
            signal, self.fs, self.window_sec, overlap_sec
        ):
            result = self.classify_window(window)
            yield result, window_num, start_idx, end_idx

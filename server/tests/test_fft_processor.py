
import pytest
import numpy as np
from app.modules.processors.fft import FFTProcessor
from app.core.types import SignalData

class TestFFTProcessor:
    def test_fft_sine_wave(self):
        """Test FFT of a simple sine wave."""
        fs = 250
        duration = 2.0
        t = np.arange(int(fs * duration)) / fs
        # 10 Hz sine wave
        freq = 10.0
        signal = np.sin(2 * np.pi * freq * t)
        
        # Create SignalData
        sig_data = SignalData(
            data=signal,
            fs=fs
        )
        
        processor = FFTProcessor()
        # Use 1.0s window for Welch
        config = {"window_sec": 1.0, "log_scale": False}
        
        result = processor.process(sig_data, config)
        
        assert result.data["method"] == "welch"
        freqs = np.array(result.data["frequencies"])
        mags = np.array(result.data["magnitudes"])
        
        # Check peak frequency
        peak_idx = np.argmax(mags)
        peak_freq = freqs[peak_idx]
        
        # Should be close to 10 Hz
        assert abs(peak_freq - freq) < 1.0
        
        # Check structure
        assert len(freqs) == len(mags)
        assert result.data["n_channels_averaged"] == 1

    def test_fft_multichannel(self):
        """Test FFT averaging across channels."""
        fs = 250
        duration = 1.0
        t = np.arange(int(fs * duration)) / fs
        
        # Channel 1: 10 Hz
        sig1 = np.sin(2 * np.pi * 10 * t)
        # Channel 2: 10 Hz
        sig2 = np.sin(2 * np.pi * 10 * t)
        
        data = np.vstack([sig1, sig2])
        
        sig_data = SignalData(data=data, fs=fs)
        processor = FFTProcessor()
        config = {"window_sec": 0.5} 
        
        result = processor.process(sig_data, config)
        
        assert result.data["n_channels_averaged"] == 2
        
        # Peak should still be around 10 Hz
        freqs = np.array(result.data["frequencies"])
        mags = np.array(result.data["magnitudes"])
        peak_freq = freqs[np.argmax(mags)]
        assert abs(peak_freq - 10.0) < 2.0

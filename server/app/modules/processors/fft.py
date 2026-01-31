import numpy as np
from scipy.signal import welch
from typing import Dict, Any, List
from app.core.interfaces import Processor
from app.core.types import SignalData, BaseResult, SpectrumResult, AnalysisResultType
from app.core.registry import Registry

class FFTProcessor(Processor):
    name = "FFT Analysis"
    description = "Fast Fourier Transform for frequency domain analysis."
    result_type = AnalysisResultType.SPECTRUM

    def get_config_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "window_sec": {
                    "type": "number",
                    "title": "Window Size (s)",
                    "default": 1.0,
                    "minimum": 0.1
                },
                "overlap": {
                    "type": "number", 
                    "title": "Overlap (%)",
                    "default": 0.0,
                    "minimum": 0.0,
                    "maximum": 1.0
                },
                "log_scale": {
                    "type": "boolean",
                    "title": "Log Scale (dB)",
                    "default": False
                }
            }
        }

    def process(self, data: SignalData, config: Dict[str, Any]) -> BaseResult:
        signal_matrix = np.array(data.data)
        fs = data.fs
        
        # 1. Config
        # window_sec determines segment length for Welch's method
        window_sec = config.get("window_sec", 1.0)
        nperseg = int(window_sec * fs)
        
        # Ensure nperseg is valid
        if nperseg > signal_matrix.shape[1]:
            nperseg = signal_matrix.shape[1]
        
        # 2. Compute PSD using Welch's method
        # This averages periodograms over overlapping windows
        f, Pxx = welch(signal_matrix, fs=fs, nperseg=nperseg, axis=-1)
        
        # 3. Average across channels if multi-channel
        if Pxx.ndim > 1:
            avg_power = np.mean(Pxx, axis=0)
            n_channels = Pxx.shape[0]
        else:
            avg_power = Pxx
            n_channels = 1
            
        # 4. Log scale if requested
        if config.get("log_scale", False):
            # Avoid log(0)
            avg_power = 10 * np.log10(avg_power + 1e-12)

        return SpectrumResult(data={
            "frequencies": f.tolist(),
            "magnitudes": avg_power.tolist(),
            "n_channels_averaged": n_channels,
            "method": "welch"
        })

Registry.register_processor(FFTProcessor)

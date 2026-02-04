import numpy as np
from typing import Dict, Any, List
from app.core.interfaces import Processor
from app.core.types import SignalData, BaseResult, ClassificationResult, AnalysisResultType
from app.core.registry import Registry
from tmsi_core import build_weight_matrix, laplacian_from_W, tmsi_score_multiple_frequencies

class TMSIProcessor(Processor):
    name = "TMSI Classifier"
    description = "Temporally Local Multivariate Synchronization Index for frequency classification."
    result_type = AnalysisResultType.CLASSIFICATION

    def get_config_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "frequencies": {
                    "type": "array",
                    "title": "Target Frequencies (Hz)",
                    "items": {"type": "number"},
                    "default": [8.0, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0],
                    "minItems": 2
                },
                "window_sec": {
                    "type": "number",
                    "title": "Window Size (s)",
                    "default": 1.0,
                    "minimum": 0.1
                },
                "n_harmonics": {
                    "type": "integer",
                    "title": "Harmonics",
                    "default": 5,
                    "minimum": 1
                }
            },
            "required": ["frequencies"]
        }

    def process(self, data: SignalData, config: Dict[str, Any]) -> BaseResult:
        # Extract config
        frequencies = config.get("frequencies", [10.0, 12.0])
        window_sec = config.get("window_sec", 1.0)
        n_harmonics = config.get("n_harmonics", 5)
        
        # Prepare Signal
        # TMSI core usually works on 1D or Multi-channel. 
        # For simplicity, if multi-channel, we might average or take the first valid channel.
        # Or better, we process the full multivariate signal if tmsi_core supports it.
        # Looking at tmsi_core.py: tmsi_score_for_frequency accepts 1D or 2D (n_channels, n_samples).
        
        signal_matrix = np.array(data.data)
        fs = int(data.fs)
        
        # Process signal in windows
        n_samples = signal_matrix.shape[1]
        target_samples = int(window_sec * fs)
        
        # Build Laplacian once for the window size
        W = build_weight_matrix(target_samples, s=25, r=3)
        L = laplacian_from_W(W)
        
        results = []
        
        # Iterate windows
        for start_idx in range(0, n_samples - target_samples + 1, target_samples):
            end_idx = start_idx + target_samples
            window_signal = signal_matrix[:, start_idx:end_idx]
            
            # Calculate scores
            scores = tmsi_score_multiple_frequencies(
                window_signal, 
                frequencies, 
                fs, 
                L, 
                n_harmonics=n_harmonics, 
                n_eeg=window_signal.shape[0]
            )
            
            # Find best match
            best_idx = np.argmax(scores)
            best_freq = frequencies[best_idx]
            sorted_indices = np.argsort(scores)[::-1]
            
            confidence = 0.0
            if len(scores) > 1:
                confidence = scores[sorted_indices[0]] - scores[sorted_indices[1]]
                
            results.append({
                "start_time": start_idx / fs,
                "end_time": end_idx / fs,
                "best_frequency": float(best_freq),
                "confidence": float(confidence),
                "scores": {
                    str(f): float(s) for f, s in zip(frequencies, scores)
                }
            })

        return ClassificationResult(
            data={
                "results": results,
                "summary": f"Processed {len(results)} windows."
            }
        )

Registry.register_processor(TMSIProcessor)

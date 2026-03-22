import numpy as np
from typing import Dict, Any, List
from app.core.interfaces import Processor
from app.core.types import SignalData, BaseResult, ClassificationResult, AnalysisResultType
from app.core.registry import Registry
from fbcca_core import fbcca_score_multiple_frequencies

class FBCCAProcessor(Processor):
    name = "FBCCA Classifier"
    description = "Filter Bank Canonical Correlation Analysis for frequency classification."
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
                },
                "n_subbands": {
                    "type": "integer",
                    "title": "Sub-bands",
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
        n_subbands = config.get("n_subbands", 5)
        step_sec = config.get("step_sec", window_sec)
        
        signal_matrix = np.array(data.data)
        fs = int(data.fs)
        
        # Process signal in windows
        n_samples = signal_matrix.shape[1]
        target_samples = int(window_sec * fs)
        
        results = []
        
        # Iterate windows
        # Note: If signal is shorter than window, we might skip or pad. 
        # Here we only take full windows.
        if n_samples < target_samples:
             # If too short, maybe just process what we have? 
             # Or return empty? The TMSI impl iterates range so it would likely skip.
             pass

        step_samples = int(step_sec * fs)
        for start_idx in range(0, n_samples - target_samples + 1, step_samples):
            end_idx = start_idx + target_samples
            window_signal = signal_matrix[:, start_idx:end_idx]
            
            # Calculate scores using FBCCA
            scores = fbcca_score_multiple_frequencies(
                window_signal, 
                frequencies, 
                fs, 
                n_harmonics=n_harmonics, 
                n_subbands=n_subbands
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
                "summary": f"Processed {len(results)} windows with FBCCA."
            }
        )

Registry.register_processor(FBCCAProcessor)

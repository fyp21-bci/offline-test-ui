from enum import Enum
from typing import List, Optional, Any, Dict
from pydantic import BaseModel

class SignalData(BaseModel):
    """
    Standard representation of loaded signal data.
    """
    data: List[List[float]]  # Shape: (n_channels, n_samples)
    fs: float
    channel_names: Optional[List[str]] = None
    timestamps: Optional[List[float]] = None
    metadata: Dict[str, Any] = {}

class AnalysisResultType(str, Enum):
    """
    Discriminator for the type of analysis result.
    Helps the UI determine how to render the output.
    """
    CLASSIFICATION = "classification"
    SPECTRUM = "spectrum"
    TIME_SERIES = "time_series"
    GENERIC = "generic"

class BaseResult(BaseModel):
    type: AnalysisResultType
    data: Dict[str, Any]

class ClassificationResult(BaseResult):
    type: AnalysisResultType = AnalysisResultType.CLASSIFICATION
    data: Dict[str, Any] 
    # Example data structure:
    # {
    #   "scores": {"freq_1": 0.9, "freq_2": 0.1},
    #   "best_match": "freq_1",
    #   "confidence": 0.8
    # }

class SpectrumResult(BaseResult):
    type: AnalysisResultType = AnalysisResultType.SPECTRUM
    data: Dict[str, Any]
    # Example data structure:
    # {
    #   "frequencies": [1, 2, 3, ...],
    #   "magnitudes": [0.1, 0.5, 0.2, ...]
    # }

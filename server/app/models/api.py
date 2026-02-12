from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal, Union
from app.core.types import AnalysisResultType

class ProcessorInfo(BaseModel):
    name: str
    description: str
    result_type: AnalysisResultType

class DatasetInfo(BaseModel):
    id: str
    filename: str
    size_bytes: int
    available_channels: List[str]
    type: Literal["upload", "recording"] = "upload"

class RunAnalysisRequest(BaseModel):
    dataset_id: str
    processor_name: str
    config: Dict[str, Any]

class AnalysisResponse(BaseModel):
    processor: str
    dataset: str
    result: Dict[str, Any] # The BaseResult.dict()

class PlotRequest(BaseModel):
    dataset_id: str
    channels: List[int] = Field(description="List of channel indices to plot")
    time_start: float = Field(description="Start time in seconds")
    time_end: float = Field(description="End time in seconds")
    plot_type: Literal["time", "fft"] = Field(
        default="time",
        description="Type of plot: 'time' for raw signal, 'fft' for frequency spectrum"
    )

class ClassificationPlotRequest(BaseModel):
    dataset_id: str
    channels: List[int] = Field(description="List of channel indices to plot")
    time_start: float = Field(description="Start time in seconds")
    time_end: float = Field(description="End time in seconds")
    processor_name: str = Field(description="Name of classification processor (e.g., 'TMSI Classifier')")
    processor_config: Dict[str, Any] = Field(
        description="Configuration for the processor. For TMSI, this includes 'window_sec' which determines sub-window size, 'frequencies' for candidates, and 'n_harmonics'."
    )
    target_frequency: Optional[Union[float, List[float], str]] = Field(
        default=None,
        description="Target frequency (or frequencies) for correctness evaluation. Can be a single float, a list of floats, or a comma-separated string (e.g. '8.0, 9.0')."
    )

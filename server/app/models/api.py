from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
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

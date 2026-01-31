from abc import ABC, abstractmethod
from typing import Any, Dict, Type, List
from app.core.types import SignalData, AnalysisResultType, BaseResult

class Processor(ABC):
    """
    Interface for a signal processing algorithm.
    """
    name: str = "Unknown Processor"
    description: str = "No description provided."
    result_type: AnalysisResultType = AnalysisResultType.GENERIC

    @abstractmethod
    def get_config_schema(self) -> Dict[str, Any]:
        """
        Return the JSON Schema for the configuration parameters.
        This is used by the UI to generate the settings form.
        """
        pass

    @abstractmethod
    def process(self, data: SignalData, config: Dict[str, Any]) -> BaseResult:
        """
        Execute the processing algorithm.
        
        Args:
            data: The signal data to process.
            config: Configuration parameters derived from get_config_schema.
            
        Returns:
            A BaseResult object (or subclass) containing the analysis results.
        """
        pass


class DataLoader(ABC):
    """
    Interface for a data file handler.
    """
    name: str = "Unknown Loader"
    extensions: List[str] = [] # e.g. ['.txt', '.csv']

    @abstractmethod
    def load(self, filepath: str) -> SignalData:
        """
        Load data from a file into the standard SignalData format.
        """
        pass
    
    @abstractmethod
    def validate(self, filepath: str) -> bool:
        """
        Check if the file is valid for this loader.
        """
        pass

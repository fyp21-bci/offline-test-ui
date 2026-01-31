import numpy as np
from typing import Dict, Any, List
from pathlib import Path
from app.core.interfaces import DataLoader
from app.core.types import SignalData
from app.core.registry import Registry
from dataset_handler import load_openbci_multiple_channels

class OpenBCILoader(DataLoader):
    name = "OpenBCI Text"
    extensions = [".txt"]

    def load(self, filepath: str) -> SignalData:
        """
        Load OpenBCI data using the existing dataset_handler logic.
        Automatically applies preprocessing to clean the signal.
        """
        # Load all channels
        data, fs, sample_indices = load_openbci_multiple_channels(filepath)
        
        # Convert numpy array to list of lists for Pydantic
        # dataset_handler returns (n_channels, n_samples) which matches our expectation
        data_list = data.tolist()
        
        raw_signal_data = SignalData(
            data=data_list,
            fs=float(fs),
            channel_names=[f"EXG Channel {i}" for i in range(len(data_list))],
            timestamps=None, # timestamps logic can be added if needed, currently dataset_handler load_openbci_multiple_channels doesn't return them
            metadata={
                "source": "OpenBCI",
                "original_path": filepath,
                "n_samples": data.shape[1]
            }
        )
        
        # Apply preprocessing automatically
        # Import here to avoid circular dependency
        from app.modules.processors.preprocessing import PreprocessingProcessor
        preprocessed_data = PreprocessingProcessor.apply_default_preprocessing(raw_signal_data)
        
        return preprocessed_data

    def validate(self, filepath: str) -> bool:
        path = Path(filepath)
        if not path.exists():
            return False
        if path.suffix != ".txt":
            return False
        # Could add more robust check (header reading) here
        return True

# Register the loader
Registry.register_dataloader(OpenBCILoader)

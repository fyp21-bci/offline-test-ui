import numpy as np
from typing import Dict, Any
from brainflow.data_filter import DataFilter, FilterTypes, DetrendOperations
from app.core.interfaces import Processor
from app.core.types import SignalData, BaseResult, AnalysisResultType
from app.core.registry import Registry


class PreprocessingProcessor(Processor):
    """
    EEG Signal Preprocessing Processor
    
    Applies a series of filters to clean EEG signals:
    1. Auto-scaling (raw counts to microvolts if needed)
    2. Detrending (removes DC drift)
    3. Bandpass filter (removes DC offset and HF noise)
    4. Notch filter (removes mains hum at 50Hz or 60Hz)
    5. Lowpass filter (additional smoothing)
    6. Bandstop filter (additional noise removal)
    """
    name = "EEG Preprocessing"
    description = "Clean and filter EEG signals using detrending, bandpass, notch, and lowpass filters."
    result_type = AnalysisResultType.GENERIC

    def get_config_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "auto_scale": {
                    "type": "boolean",
                    "title": "Auto-scale to µV",
                    "description": "Automatically detect and convert raw counts to microvolts",
                    "default": True
                },
                "scale_factor_uv": {
                    "type": "number",
                    "title": "Manual Scale Factor (µV)",
                    "description": "Manual scaling factor if auto-scale is disabled. Formula: 4.5 / gain / (2^23 - 1) * 1e6",
                    "default": 0.02235174,
                    "minimum": 0
                },
                "apply_detrend": {
                    "type": "boolean",
                    "title": "Apply Detrending",
                    "description": "Remove DC drift using linear detrending",
                    "default": True
                },
                "bandpass_enabled": {
                    "type": "boolean",
                    "title": "Enable Bandpass Filter",
                    "default": True
                },
                "bandpass_low": {
                    "type": "number",
                    "title": "Bandpass Low Cutoff (Hz)",
                    "default": 1.0,
                    "minimum": 0.1
                },
                "bandpass_high": {
                    "type": "number",
                    "title": "Bandpass High Cutoff (Hz)",
                    "default": 50.0,
                    "minimum": 1.0
                },
                "bandpass_order": {
                    "type": "integer",
                    "title": "Bandpass Filter Order",
                    "default": 4,
                    "minimum": 1,
                    "maximum": 8
                },
                "notch_enabled": {
                    "type": "boolean",
                    "title": "Enable Notch Filter",
                    "description": "Remove mains hum (50Hz or 60Hz)",
                    "default": True
                },
                "notch_center": {
                    "type": "number",
                    "title": "Notch Center Frequency (Hz)",
                    "description": "50Hz for Europe/Asia, 60Hz for North America",
                    "default": 50.0,
                    "enum": [50.0, 60.0]
                },
                "notch_width": {
                    "type": "number",
                    "title": "Notch Width (Hz)",
                    "description": "Bandwidth around center frequency to remove",
                    "default": 2.0,
                    "minimum": 0.5,
                    "maximum": 10.0
                },
                "lowpass_enabled": {
                    "type": "boolean",
                    "title": "Enable Lowpass Filter",
                    "default": True
                },
                "lowpass_cutoff": {
                    "type": "number",
                    "title": "Lowpass Cutoff (Hz)",
                    "default": 50.0,
                    "minimum": 1.0
                },
                "lowpass_order": {
                    "type": "integer",
                    "title": "Lowpass Filter Order",
                    "default": 4,
                    "minimum": 1,
                    "maximum": 8
                },
                "bandstop_enabled": {
                    "type": "boolean",
                    "title": "Enable Additional Bandstop",
                    "description": "Extra noise removal in 50-60Hz range",
                    "default": True
                },
                "bandstop_low": {
                    "type": "number",
                    "title": "Bandstop Low (Hz)",
                    "default": 50.0,
                    "minimum": 1.0
                },
                "bandstop_high": {
                    "type": "number",
                    "title": "Bandstop High (Hz)",
                    "default": 60.0,
                    "minimum": 1.0
                }
            }
        }

    def process(self, data: SignalData, config: Dict[str, Any]) -> BaseResult:
        """
        Apply preprocessing pipeline to EEG signal data.
        
        Args:
            data: Input signal data (multi-channel)
            config: Configuration parameters from schema
            
        Returns:
            BaseResult containing preprocessed signal data
        """
        # Convert to numpy array and make a copy to avoid modifying original
        signal_matrix = np.array(data.data, dtype=np.float64)
        fs = data.fs
        
        # Get configuration
        auto_scale = config.get("auto_scale", True)
        scale_factor = config.get("scale_factor_uv", 0.02235174)
        
        # 1. SCALING: Convert raw counts to microvolts if needed
        if auto_scale:
            # Heuristic: if values are very large, assume raw counts
            if np.abs(signal_matrix).mean() > 1000:
                print(f"Auto-scaling detected: applying scale factor {scale_factor:.6f}")
                signal_matrix = signal_matrix * scale_factor
        
        # Create processed copy
        processed_data = np.copy(signal_matrix)
        
        # Process each channel independently
        for channel_idx in range(processed_data.shape[0]):
            channel_data = processed_data[channel_idx]
            
            # 2. DETRENDING: Remove DC drift
            if config.get("apply_detrend", True):
                DataFilter.detrend(channel_data, DetrendOperations.LINEAR.value)
            
            # 3. BANDPASS FILTER: Remove DC offset and high-frequency noise
            if config.get("bandpass_enabled", True):
                low_cutoff = config.get("bandpass_low", 1.0)
                high_cutoff = config.get("bandpass_high", 50.0)
                order = config.get("bandpass_order", 4)
                
                DataFilter.perform_bandpass(
                    channel_data, fs,
                    low_cutoff, high_cutoff,
                    order, FilterTypes.BUTTERWORTH.value, 0
                )
            
            # 4. NOTCH FILTER: Remove mains hum (50Hz or 60Hz)
            if config.get("notch_enabled", True):
                center_freq = config.get("notch_center", 50.0)
                width = config.get("notch_width", 2.0)
                
                # Calculate bandstop range
                notch_low = center_freq - (width / 2)
                notch_high = center_freq + (width / 2)
                
                DataFilter.perform_bandstop(
                    channel_data, fs,
                    notch_low, notch_high,
                    4, FilterTypes.BUTTERWORTH.value, 0
                )
            
            # 5. LOWPASS FILTER: Additional smoothing
            if config.get("lowpass_enabled", True):
                cutoff = config.get("lowpass_cutoff", 50.0)
                order = config.get("lowpass_order", 4)
                
                DataFilter.perform_lowpass(
                    channel_data, fs,
                    cutoff,
                    order, FilterTypes.BUTTERWORTH.value, 0
                )
            
            # 6. BANDSTOP FILTER: Additional noise removal
            if config.get("bandstop_enabled", True):
                low = config.get("bandstop_low", 50.0)
                high = config.get("bandstop_high", 60.0)
                
                # Only apply if low < high
                if low < high:
                    DataFilter.perform_bandstop(
                        channel_data, fs,
                        low, high,
                        4, FilterTypes.BUTTERWORTH.value, 0
                    )
        
        # Return preprocessed signal as new SignalData
        return BaseResult(data={
            "preprocessed_signal": SignalData(
                data=processed_data.tolist(),
                fs=fs,
                channel_names=data.channel_names,
                timestamps=data.timestamps,
                metadata={
                    **data.metadata,
                    "preprocessing_applied": True,
                    "filters": {
                        "auto_scaled": auto_scale and np.abs(signal_matrix).mean() > 1000,
                        "detrended": config.get("apply_detrend", True),
                        "bandpass": config.get("bandpass_enabled", True),
                        "notch": config.get("notch_enabled", True),
                        "lowpass": config.get("lowpass_enabled", True),
                        "bandstop": config.get("bandstop_enabled", True)
                    }
                }
            )
        })
    
    @staticmethod
    def apply_default_preprocessing(signal_data: SignalData) -> SignalData:
        """
        Apply default preprocessing to signal data.
        This is a utility method for data loaders to auto-preprocess signals.
        
        Args:
            signal_data: Raw signal data
            
        Returns:
            Preprocessed SignalData with default settings
        """
        # Default configuration
        default_config = {
            "auto_scale": True,
            "scale_factor_uv": 0.02235174,
            "apply_detrend": True,
            "bandpass_enabled": True,
            "bandpass_low": 1.0,
            "bandpass_high": 50.0,
            "bandpass_order": 4,
            "notch_enabled": True,
            "notch_center": 50.0,
            "notch_width": 2.0,
            "lowpass_enabled": True,
            "lowpass_cutoff": 50.0,
            "lowpass_order": 4,
            "bandstop_enabled": True,
            "bandstop_low": 50.0,
            "bandstop_high": 60.0
        }
        
        # Convert to numpy array and make a copy
        signal_matrix = np.array(signal_data.data, dtype=np.float64)
        fs = int(signal_data.fs)  # BrainFlow requires int for sampling rate
        
        # Auto-scaling
        if default_config["auto_scale"]:
            if np.abs(signal_matrix).mean() > 1000:
                scale_factor = default_config["scale_factor_uv"]
                signal_matrix = signal_matrix * scale_factor
        
        # Create processed copy
        processed_data = np.copy(signal_matrix)
        
        # Process each channel
        for channel_idx in range(processed_data.shape[0]):
            channel_data = processed_data[channel_idx]
            
            # Detrending
            if default_config["apply_detrend"]:
                DataFilter.detrend(channel_data, DetrendOperations.LINEAR.value)
            
            # Bandpass
            if default_config["bandpass_enabled"]:
                DataFilter.perform_bandpass(
                    channel_data, fs,
                    default_config["bandpass_low"], 
                    default_config["bandpass_high"],
                    default_config["bandpass_order"], 
                    FilterTypes.BUTTERWORTH.value, 0
                )
            
            # Notch
            if default_config["notch_enabled"]:
                center = default_config["notch_center"]
                width = default_config["notch_width"]
                notch_low = center - (width / 2)
                notch_high = center + (width / 2)
                
                DataFilter.perform_bandstop(
                    channel_data, fs,
                    notch_low, notch_high,
                    4, FilterTypes.BUTTERWORTH.value, 0
                )
            
            # Lowpass
            if default_config["lowpass_enabled"]:
                DataFilter.perform_lowpass(
                    channel_data, fs,
                    default_config["lowpass_cutoff"],
                    default_config["lowpass_order"],
                    FilterTypes.BUTTERWORTH.value, 0
                )
            
            # Bandstop
            if default_config["bandstop_enabled"]:
                low = default_config["bandstop_low"]
                high = default_config["bandstop_high"]
                
                if low < high:
                    DataFilter.perform_bandstop(
                        channel_data, fs,
                        low, high,
                        4, FilterTypes.BUTTERWORTH.value, 0
                    )
        
        # Return new SignalData with preprocessed data
        return SignalData(
            data=processed_data.tolist(),
            fs=fs,
            channel_names=signal_data.channel_names,
            timestamps=signal_data.timestamps,
            metadata={
                **signal_data.metadata,
                "preprocessing_applied": True,
                "preprocessing_config": "default"
            }
        )


# Register the processor
Registry.register_processor(PreprocessingProcessor)

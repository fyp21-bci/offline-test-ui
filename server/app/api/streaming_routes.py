from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.core.stream_manager import StreamManager

router = APIRouter()
stream_manager = StreamManager()

class StreamStartRequest(BaseModel):
    serial_port: str = "/dev/ttyUSB0"
    board_id: int = -1 # Default to Synthetic for testing if not specified? Or strictly Cyton? 
    # Let's keep it safe. If user didn't ask, maybe better to default to Cyton (0) or provide option.
    # Actually Cyton is 0. Synthetic is -1.
    board_id: Optional[int] = None 
    window_size_seconds: float = 3.0
    update_interval_seconds: float = 1.0
    target_frequency: Optional[float] = None # Used for coloring
    classification_window_size: Optional[float] = None # Window size for classification algorithms
    
    # New Configs
    channels: Optional[List[int]] = None # Indices to process/stream
    candidate_frequencies: Optional[List[float]] = None # For TMSI
    
    # Processor Selection
    processors: List[str] = ["TMSI Classifier"]
    processors: List[str] = ["TMSI Classifier"]
    processor_configs: Dict[str, Dict[str, Any]] = {}

class RecordStartRequest(BaseModel):
    filename: Optional[str] = None

class GameStreamStartRequest(BaseModel):
    # Connection params
    serial_port: str = "/dev/ttyUSB0"
    board_id: Optional[int] = None
    
    # Configuration
    window_length: float = 3.0 # Maps to classification_window_size
    refresh_rate: float = 0.5 # Maps to update_interval_seconds
    
    # Algorithms
    algorithms: List[str] = ["TMSI Classifier"] # Maps to processors
    candidate_frequencies: Optional[List[float]] = None
    
    # Optional
    channels: Optional[List[int]] = None
    decision_buffer_size: int = 5

@router.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await stream_manager.connect_client(websocket)

@router.post("/stream/start")
async def start_stream(request: StreamStartRequest):
    try:
        stream_manager.start_stream(
            serial_port=request.serial_port,
            board_id=request.board_id,
            window_size=request.window_size_seconds,
            update_interval=request.update_interval_seconds,
            channels=request.channels,
            target_frequency=request.target_frequency,
            candidate_frequencies=request.candidate_frequencies,
            processors=request.processors,
            processor_configs=request.processor_configs,
            classification_window_size=request.classification_window_size
        )
        return {"status": "success", "message": "Stream started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stream/stop")
async def stop_stream():
    stream_manager.stop_stream()
    return {"status": "success", "message": "Stream stopped"}

@router.get("/stream/status")
async def get_stream_status():
    return stream_manager.get_status()

@router.post("/stream/record/start")
async def start_recording(request: RecordStartRequest):
    try:
        stream_manager.start_recording(filename=request.filename)
        return {"status": "success", "message": "Recording started", "filename": stream_manager.recording_filename}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/stream/record/stop")
async def stop_recording():
    stream_manager.stop_recording()
    return {"status": "success", "message": "Recording stopped"}

@router.post("/stream/game/start")
async def start_game_stream(request: GameStreamStartRequest):
    try:
        # Stop existing if any (optional, but good practice)
        if stream_manager.is_streaming:
             stream_manager.stop_stream()
             
        stream_manager.start_stream(
            serial_port=request.serial_port,
            board_id=request.board_id,
            window_size=request.window_length, # Core buffer window
            update_interval=request.refresh_rate,
            channels=request.channels,
            target_frequency=None, # Not used for game mode usually
            candidate_frequencies=request.candidate_frequencies,
            processors=request.algorithms,
            processor_configs={"use_decision_buffer": True}, 
            classification_window_size=request.window_length,
            generate_plots=False,
            decision_buffer_size=request.decision_buffer_size
        )
        return {"status": "success", "message": "Game stream started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class QuestionnaireStartRequest(BaseModel):
    # Connection params
    serial_port: str = "/dev/ttyUSB0"
    board_id: int = 0

    # Recording config
    recording_length: float  # Total seconds to record
    window_size: float = 2.0  # Classification window width in seconds
    refresh_rate: float = 0.5  # Step between windows in seconds

    # Classifier config
    algorithms: List[str] = ["TMSI Classifier"]
    candidate_frequencies: List[float] = [8.0, 10.0, 12.0, 14.0]
    n_harmonics: int = 5

    # Optional
    channels: Optional[List[int]] = None


@router.post("/stream/questionnaire/start")
async def start_questionnaire(request: QuestionnaireStartRequest):
    """
    Start a questionnaire session.

    Starts (or reuses) the BrainFlow stream, then records EEG for
    `recording_length` seconds. After the recording, overlapping windows
    of width `window_size` stepped by `refresh_rate` are classified by
    TMSI and the majority-vote frequency is stored as the result.

    Poll GET /stream/questionnaire/result to retrieve the outcome.
    """
    try:
        # Start stream if not already running
        if not stream_manager.is_streaming:
            stream_manager.start_stream(
                serial_port=request.serial_port,
                board_id=request.board_id,
                window_size=request.window_size,
                update_interval=request.refresh_rate,
                channels=request.channels,
                target_frequency=None,
                candidate_frequencies=request.candidate_frequencies,
                processors=request.algorithms,
                processor_configs={},
                classification_window_size=request.window_size,
                generate_plots=False,
                decision_buffer_size=1
            )

        # Compute the number of overlapping segments for the response
        import math
        n_segments = max(
            1,
            math.floor((request.recording_length - request.window_size) / request.refresh_rate) + 1
        ) if request.recording_length >= request.window_size else 1

        stream_manager.start_questionnaire_recording({
            "recording_length": request.recording_length,
            "window_size": request.window_size,
            "refresh_rate": request.refresh_rate,
            "candidate_frequencies": request.candidate_frequencies,
            "algorithms": request.algorithms,
            "channels": request.channels,
            "n_harmonics": request.n_harmonics
        })

        return {
            "status": "recording",
            "message": f"Questionnaire recording started for {request.recording_length}s",
            "recording_length": request.recording_length,
            "window_size": request.window_size,
            "refresh_rate": request.refresh_rate,
            "estimated_segments": n_segments,
            "candidate_frequencies": request.candidate_frequencies
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stream/questionnaire/result")
async def get_questionnaire_result():
    """
    Poll for the questionnaire result.

    Returns:
    - `done`: true when classification is complete
    - `recording_in_progress`: true while still recording
    - `elapsed`: seconds since questionnaire started
    - `recording_length`: total configured recording duration
    - `result`: null while recording; once done contains:
        - `majority_frequency`: the winning frequency (float)
        - `segment_count`: number of classification windows
        - `frequency_counts`: dict mapping frequency → count
        - `all_decisions`: list of per-segment decisions
    """
    return stream_manager.get_questionnaire_result()

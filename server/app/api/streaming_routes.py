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

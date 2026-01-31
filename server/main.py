"""
Entry point for the Signal Processing Server.
Run with: uv run main.py
"""
import uvicorn

def main():
    """Start the FastAPI server."""
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

if __name__ == "__main__":
    main()

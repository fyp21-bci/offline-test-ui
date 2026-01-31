# Modular Signal Processing Server

## Overview
Backend for storing datasets and running pluggable analysis algorithms.

## Prerequisites
- Python >= 3.12
- `uv` package manager

## Installation
Install dependencies using `uv`:
```bash
uv sync
```

## Running the Server
To start the development server:
```bash
uv run app/main.py
```
Or directly with uvicorn:
```bash
uv run uvicorn app.main:app --reload
```

The server will be available at `http://localhost:8000`.
API documentation is available at `http://localhost:8000/docs`.

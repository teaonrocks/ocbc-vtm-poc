# Faster Whisper Service

This package provides a FastAPI service for transcribing audio using `faster-whisper`.

## Setup

1. Create a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and adjust settings if needed.
   ```bash
   cp env.example .env
   ```

   Variables:
   - `FWHISPER_MODEL`: Model size (default: `distil-large-v3`)
   - `FWHISPER_DEVICE`: `cuda` or `cpu` or `auto` (default: `auto`)
   - `FWHISPER_COMPUTE_TYPE`: `float16`, `int8_float16`, `int8` (default: `int8`)

## Usage

Start the server:
```bash
uvicorn main:app --reload --port 8000
```

API Documentation available at `http://localhost:8000/docs`.

## Integration Tests

Run the integration tests to verify the server:
```bash
python3 test_integration.py
```


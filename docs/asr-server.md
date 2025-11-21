# ASR Server Setup

This guide covers setting up the local `faster-whisper` server on your development machine (macOS/Linux).

## Prerequisites

1.  **Python 3.10+**:
    *   Check version: `python3 --version`
    *   Install via Homebrew (macOS): `brew install python@3.10`
    *   Install via apt (Ubuntu): `sudo apt install python3.10 python3.10-venv`

2.  **FFmpeg**:
    *   Required for audio processing.
    *   Check version: `ffmpeg -version`
    *   Install via Homebrew (macOS): `brew install ffmpeg`
    *   Install via apt (Ubuntu): `sudo apt install ffmpeg`

3.  **Hardware Acceleration (Optional but Recommended)**:
    *   **macOS (Apple Silicon)**: No extra drivers needed; `ctranslate2` supports Metal/CoreML automatically via CPU optimization or specific build flags, but generally runs fast on CPU for `distil-large-v3`.
    *   **NVIDIA GPU (Linux/Windows)**: Install CUDA 12.x and cuDNN 8.x.
        *   Verify with `nvidia-smi`.

## Installation

1.  Navigate to the service directory:
    ```bash
    cd packages/asr-service
    ```

2.  Create a virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Running the Server

1.  Activate the virtual environment (if not active):
    ```bash
    source packages/asr-service/venv/bin/activate
    ```

2.  Start the server:
    ```bash
    uvicorn main:app --reload --port 8000
    ```

    The API will be available at `http://localhost:8000`.

## Environment Variables

Create a `.env` file in `packages/asr-service/` (copy from `.env.example`) to configure the server:

*   `FWHISPER_MODEL`: Model size (default: `distil-large-v3`).
*   `FWHISPER_DEVICE`: Device to run on (`cpu`, `cuda`, `auto`). Default: `auto`.
*   `FWHISPER_COMPUTE_TYPE`: Quantization type (`int8`, `float16`, `float32`). Default: `int8`.


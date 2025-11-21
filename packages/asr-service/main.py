from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from faster_whisper import WhisperModel
import os
import tempfile
import shutil
import time


class Settings(BaseSettings):
    FWHISPER_MODEL: str = "large-v3"
    FWHISPER_DEVICE: str = "auto"
    FWHISPER_COMPUTE_TYPE: str = "int8"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model
print(f"Loading model {settings.FWHISPER_MODEL} on {settings.FWHISPER_DEVICE}...")
try:
    model = WhisperModel(
        settings.FWHISPER_MODEL,
        device=settings.FWHISPER_DEVICE,
        compute_type=settings.FWHISPER_COMPUTE_TYPE,
    )
    print("Model loaded successfully")
except Exception as e:
    print(f"Failed to load model: {e}")
    model = None


@app.get("/healthz")
async def healthz():
    if not model:
        raise HTTPException(status_code=503, detail="Model not initialized")
    return {"status": "ok", "model": settings.FWHISPER_MODEL}


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = None,
    task: str = "transcribe",
    beam_size: int = 5,
):
    if not model:
        raise HTTPException(status_code=503, detail="Model not initialized")

    start_time = time.time()

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_path = temp_file.name

    try:
        segments, info = model.transcribe(
            temp_path, beam_size=beam_size, language=language, task=task
        )

        # Consume generator
        segments_list = list(segments)
        full_text = "".join([segment.text for segment in segments_list]).strip()

        return {
            "text": full_text,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "processing_time": time.time() - start_time,
            "segments": [
                {"start": s.start, "end": s.end, "text": s.text} for s in segments_list
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

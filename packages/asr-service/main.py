from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from faster_whisper import WhisperModel
import os
import re
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

CJK_REGEX = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]")
TAMIL_REGEX = re.compile(r"[\u0B80-\u0BFF]")
ASCII_LETTER_REGEX = re.compile(r"[a-z]", re.IGNORECASE)
MALAY_LANGUAGE_CODES = {"ms", "msa", "zsm"}
MALAY_KEYWORDS = {
    "akaun",
    "akaun simpanan",
    "akaun semasa",
    "akaun kredit",
    "akaun debit",
    "bank",
    "pindahan",
    "pemindahan",
    "pindahkan",
    "memindahkan",
    "transfer",
    "wang",
    "duit",
    "tunai",
    "nombor",
    "jumlah",
    "baki",
    "semak",
    "bayaran",
    "pembayaran",
    "penghantaran",
    "pengeluaran",
    "deposit",
    "pinjaman",
    "kadar",
    "faedah",
    "sila",
    "terima kasih",
    "tolong",
    "daripada",
    "kepada",
    "perlu",
    "anda",
    "butiran",
    "cawangan",
    "pengesahan",
    "kemas kini",
    "kad",
    "pelanggan",
    "rujukan",
    "perbankan",
    "kewangan",
    "saya",
}


def normalize_language_code(code: str | None) -> str | None:
    if not code:
        return None
    normalized = code.lower()
    if normalized == "english":
        return "en"
    if normalized in {"chinese", "cmn"}:
        return "zh"
    if normalized == "tamil":
        return "ta"
    if normalized in MALAY_LANGUAGE_CODES or normalized == "malay":
        return "ms"
    return normalized


def infer_language_from_text(text: str) -> str | None:
    if not text:
        return None
    if CJK_REGEX.search(text):
        return "zh"
    if TAMIL_REGEX.search(text):
        return "ta"
    lower_text = text.lower()
    if any(keyword in lower_text for keyword in MALAY_KEYWORDS):
        return "ms"
    if ASCII_LETTER_REGEX.search(text):
        return "en"
    return None


def looks_english(text: str) -> bool:
    if not text:
        return False
    if CJK_REGEX.search(text) or TAMIL_REGEX.search(text):
        return False
    clean = re.sub(r"[^a-zA-Z\s]", "", text)
    letter_ratio = len(clean) / max(len(text), 1)
    if letter_ratio < 0.6:
        return False
    lower_text = text.lower()
    if any(keyword in lower_text for keyword in MALAY_KEYWORDS):
        return False
    return True


def guard_language_prediction(
    transcript_text: str, detected_language: str | None
) -> tuple[str, bool]:
    normalized = normalize_language_code(detected_language) or "unknown"

    if normalized == "ms" and looks_english(transcript_text):
        return "en", True

    if normalized == "unknown":
        inferred = infer_language_from_text(transcript_text)
        if inferred:
            return inferred, True

    return normalized, False


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

        guarded_language, guard_applied = guard_language_prediction(
            full_text, info.language
        )

        return {
            "text": full_text,
            "language": guarded_language,
            "language_guard_applied": guard_applied,
            "language_model_raw": info.language,
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

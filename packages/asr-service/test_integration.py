import requests
import os

# Configuration
BASE_URL = "http://localhost:8000"
TEST_FILES = {
    # Add paths to sample audio files here if you have them
    # "en": "samples/english.webm",
    # "zh": "samples/chinese.webm",
    # "ms": "samples/malay.webm", 
}

def test_health():
    print("Testing /healthz...")
    try:
        response = requests.get(f"{BASE_URL}/healthz")
        assert response.status_code == 200
        print(f"✅ Health check passed: {response.json()}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")

def test_transcription():
    print("\nTesting /transcribe (mocking file upload)...")
    
    # Create a dummy file for testing if no real samples exist
    dummy_content = b"dummy webm content"
    files = {'file': ('test.webm', dummy_content, 'audio/webm')}
    
    try:
        # This will likely fail transcription content-wise but should hit the endpoint
        # and hopefully return a 500 from faster-whisper internal error on bad audio,
        # OR 200 if we had a real file. 
        # For now just check connectivity.
        response = requests.post(f"{BASE_URL}/transcribe", files=files)
        
        if response.status_code == 200:
             print(f"✅ Transcription successful: {response.json()}")
        elif response.status_code == 500:
             print(f"✅ Endpoint reached (expected failure on dummy audio): {response.text}")
        else:
             print(f"❌ Unexpected status: {response.status_code} {response.text}")

    except Exception as e:
        print(f"❌ Transcription test failed: {e}")

if __name__ == "__main__":
    test_health()
    test_transcription()


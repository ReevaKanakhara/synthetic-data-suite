"""
End-to-end test for Phase 2.
Run: python test_e2e.py

Tests the full flow:
  POST /api/generate → poll /api/status → verify image file exists
"""
import time
import requests
from pathlib import Path

BASE = "http://localhost:8000"
PROMPT = "a cute doll wearing purple frock."
POLL_INTERVAL = 1   # seconds
MAX_WAIT = 30       # seconds (mock mode should finish in < 2s)


def run():
    print(f"\n{'='*55}")
    print("  Synthetic Data Suite — Phase 2 E2E Test")
    print(f"{'='*55}\n")

    # 1. Submit generation request
    print(f"[1] POST /api/generate  prompt='{PROMPT}'")
    resp = requests.post(f"{BASE}/api/generate", json={"prompt": PROMPT})
    resp.raise_for_status()
    data = resp.json()
    task_id = data["task_id"]
    image_id = data["image_id"]
    print(f"    ✓ task_id  : {task_id}")
    print(f"    ✓ image_id : {image_id}\n")

    # 2. Poll for status
    print(f"[2] Polling /api/status/{task_id} ...")
    elapsed = 0
    while elapsed < MAX_WAIT:
        status_resp = requests.get(f"{BASE}/api/status/{task_id}")
        status_resp.raise_for_status()
        status_data = status_resp.json()
        status = status_data["status"]
        print(f"    [{elapsed:02d}s] status = {status}")

        if status == "SUCCESS":
            print(f"\n    ✓ image_url : {status_data['image_url']}")
            print(f"    ✓ dimensions: {status_data['width']} × {status_data['height']} px")
            break
        elif status == "FAILURE":
            print(f"\n    ✗ FAILED: {status_data.get('error_message')}")
            return
        
        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL
    else:
        print(f"\n    ✗ Timed out after {MAX_WAIT}s")
        return

    # 3. Verify file on disk
    print(f"\n[3] Verifying file on disk...")
    image_path = Path(f"./uploads/{image_id}.png")
    if image_path.exists():
        size_kb = image_path.stat().st_size / 1024
        print(f"    ✓ File exists: {image_path} ({size_kb:.1f} KB)")
    else:
        print(f"    ✗ File NOT found at {image_path}")
        return

    # 4. Fetch the image via HTTP
    print(f"\n[4] Fetching image via HTTP...")
    img_resp = requests.get(f"{BASE}/uploads/{image_id}.png")
    if img_resp.status_code == 200:
        print(f"    ✓ HTTP 200 — Content-Type: {img_resp.headers.get('content-type')}")
    else:
        print(f"    ✗ HTTP {img_resp.status_code}")
        return

    print(f"\n{'='*55}")
    print("  ✅  Phase 2 Complete — All checks passed!")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    run()
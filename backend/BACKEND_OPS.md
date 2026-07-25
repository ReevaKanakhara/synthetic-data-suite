# 🏗️ The 4-Step Launch Protocol

### Step 1: Wake the "Messenger" (Redis)
Before your code can talk to the worker, the "Waiting Room" must be open.
*   **Action:** Ensure Docker Desktop is running.
*   **Command:** Open any terminal and run:

```powershell
docker run -d -p 6379:6379 redis:alpine
```

> **Pro Tip:** If Docker says "Conflict," it just means Redis is already running. You’re good to go!

---

### Step 2: Activate the "Brain" (FastAPI)
This handles your web interface and database records.
1.  **Open Terminal 1** in VS Code.
2.  **Navigate & Activate:**

```powershell
cd backend
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\venv\Scripts\activate
```

3.  **Start Server:**
```powershell
uvicorn app.main:app --reload
```

*   **Verify:** Check [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) in your browser.

---

### Step 3: Wake the "Muscle" (Celery Worker)
This is the part that actually generates the images.
1.  **Open Terminal 2** (Click the **+** in VS Code terminals).
2.  **Navigate & Activate:**
```powershell
cd backend
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\venv\Scripts\activate
```

3.  **Start Worker:**

```powershell
$env:PYTHONPATH="."; celery -A app.tasks.celery_worker worker --loglevel=info -P solo
```

*   **Verify:** Look for the message `celery@computername ready`.

---

### Step 4: The "Deep Clean" (If things get weird)
If you get "Connection Errors" after your PC wakes from sleep, run these "Reset" commands:

| Issue | Command to Run |
| :--- | :--- |
| **Redis Stuck** | `docker stop $(docker ps -q)` then repeat Step 1 |
| **Port 8000 Busy** | `Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess -Force` |
| **Venv Missing** | `python -m venv venv` then `pip install -r requirements.txt` |

---

## 📂 Quick Reference: Project Map
*   **Database Location:** `E:\synthetic-data-suite\backend\synthetic_data.db`
*   **Image Storage:** `E:\synthetic-data-suite\backend\uploads\`
*   **Docker Data (Heavy):** Safely stored on your **D: Drive**.
```
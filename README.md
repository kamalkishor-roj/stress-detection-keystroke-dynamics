# Cognitive Load Detector — Electron App

A desktop app that tracks keystroke and mouse dynamics in the background, batches 30 seconds of data, and sends it to your Python ML model for cognitive load analysis.

---

## Project Structure

```
cognitive-load-app/
├── src/
│   ├── main.js          # Electron main process (tracking, IPC, Python bridge)
│   ├── preload.js       # Secure context bridge
│   ├── mouse-tracker.js # Cross-platform mouse event module
│   ├── index.html       # App UI
│   └── renderer.js      # UI logic
├── ml/
│   └── model.py         # ← YOUR ML MODEL GOES HERE
├── assets/
│   └── icon.png         # App icon (add your own)
└── package.json
```

---

## Setup

### 1. Prerequisites
- **Node.js** v18+
- **Python 3.8+** (must be available as `python3` in PATH)
- **npm**

### 2. Install dependencies

```bash
cd cognitive-load-app
npm install
```

### 3. Native module setup (for keyboard & mouse tracking)

The app uses `node-global-key-listener` for keystrokes. On some platforms you may need:

**macOS:** Grant Accessibility permissions:  
`System Preferences → Security & Privacy → Accessibility → Add your Terminal/Electron app`

**Linux:** May require running with `sudo` or adding udev rules for `/dev/input`.

**Windows:** Should work out of the box.

For mouse tracking, install either:
```bash
npm install robotjs   # easier to install
# OR
npm install iohook    # more complete events
```

### 4. Run the app

```bash
npm start
```

---

## Integrating Your ML Model

Edit **`ml/model.py`** — specifically the `predict(features)` function.

### Input to your model
The `features` dict contains aggregated stats from 30 seconds:

| Feature | Description |
|---|---|
| `mean_keystrokes_per_sec` | Average keystrokes per second |
| `std_keystrokes_per_sec` | Variance in keystroke rate |
| `mean_key_hold_ms` | Average key hold duration (ms) |
| `std_key_hold_ms` | Variance in hold duration |
| `mean_key_interval_ms` | Average time between keystrokes |
| `std_key_interval_ms` | Variance in keystroke intervals |
| `mean_mouse_movements` | Average mouse movements per second |
| `total_mouse_clicks` | Total clicks in 30s |
| `total_scroll_events` | Total scroll events in 30s |
| `mean_mouse_speed` | Average mouse speed (px/s) |
| `std_mouse_speed` | Variance in mouse speed |
| `total_path_length` | Total mouse travel distance (px) |

### Example: Loading a scikit-learn model

```python
import joblib
import numpy as np

MODEL = joblib.load(os.path.join(os.path.dirname(__file__), "trained_model.pkl"))
FEATURE_ORDER = [
    "mean_keystrokes_per_sec", "std_keystrokes_per_sec",
    "mean_key_hold_ms", "std_key_hold_ms",
    "mean_key_interval_ms", "std_key_interval_ms",
    "mean_mouse_movements", "total_mouse_clicks",
    "total_scroll_events", "mean_mouse_speed",
    "std_mouse_speed", "total_path_length"
]

def predict(features):
    X = np.array([[features[k] for k in FEATURE_ORDER]])
    label = MODEL.predict(X)[0]
    proba = MODEL.predict_proba(X)[0].tolist()
    return {
        "cognitive_load_level": label,
        "confidence": max(proba),
        "probabilities": {"LOW": proba[0], "MEDIUM": proba[1], "HIGH": proba[2]}
    }
```

### Output from your model
Return **any JSON-serializable dict** — it will be displayed as-is in the app.

---

## Building for Distribution

```bash
# macOS
npm run build -- --mac

# Windows
npm run build -- --win

# Linux
npm run build -- --linux
```

---

## How It Works

1. User clicks **START** → app begins tracking keystrokes & mouse
2. Every second, a snapshot of activity is recorded
3. After 30 seconds, the batch is sent to `ml/model.py` via stdin as JSON
4. Python model prints its result JSON to stdout
5. Result is displayed in the **RESULTS** panel
6. App continues tracking and sending new batches every 30 seconds
7. App keeps running in the **system tray** when window is closed

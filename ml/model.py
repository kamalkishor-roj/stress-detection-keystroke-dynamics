#!/usr/bin/env python3
"""
cognitive_load_model.py
=======================
Entry point for the Cognitive Load ML model.

The Electron app sends a JSON object via stdin:
{
  "batch": [
    {
      "timestamp": 1700000000000,
      "keystrokes_per_second": 3,
      "avg_key_hold_duration_ms": 120.5,
      "avg_key_interval_ms": 210.3,
      "mouse_movement_count": 45,
      "mouse_clicks": 2,
      "scroll_events": 1,
      "avg_mouse_speed": 300.2,
      "mouse_path_length": 1500.0
    },
    ... (30 entries, one per second)
  ]
}

Your model should:
1. Read and parse the JSON from stdin
2. Run inference
3. Print a single JSON object to stdout — this is displayed in the app

Replace the PLACEHOLDER section below with your actual model logic.
"""

import sys
import json
import statistics


def extract_features(batch):
    """Aggregate 30 seconds of per-second data into feature vector."""
    def safe_mean(lst):
        return statistics.mean(lst) if lst else 0.0

    def safe_stdev(lst):
        return statistics.stdev(lst) if len(lst) > 1 else 0.0

    kps       = [s["keystrokes_per_second"]     for s in batch]
    hold      = [s["avg_key_hold_duration_ms"]  for s in batch]
    interval  = [s["avg_key_interval_ms"]       for s in batch]
    mv_count  = [s["mouse_movement_count"]      for s in batch]
    clicks    = [s["mouse_clicks"]              for s in batch]
    scrolls   = [s["scroll_events"]             for s in batch]
    speed     = [s["avg_mouse_speed"]           for s in batch]
    path_len  = [s["mouse_path_length"]         for s in batch]

    return {
        "mean_keystrokes_per_sec":  safe_mean(kps),
        "std_keystrokes_per_sec":   safe_stdev(kps),
        "mean_key_hold_ms":         safe_mean(hold),
        "std_key_hold_ms":          safe_stdev(hold),
        "mean_key_interval_ms":     safe_mean(interval),
        "std_key_interval_ms":      safe_stdev(interval),
        "mean_mouse_movements":     safe_mean(mv_count),
        "total_mouse_clicks":       sum(clicks),
        "total_scroll_events":      sum(scrolls),
        "mean_mouse_speed":         safe_mean(speed),
        "std_mouse_speed":          safe_stdev(speed),
        "total_path_length":        sum(path_len),
    }


def predict(features):
    """
    ──────────────────────────────────────────────────────────────────────────
    REPLACE THIS FUNCTION WITH YOUR ACTUAL ML MODEL
    ──────────────────────────────────────────────────────────────────────────

    Options:
      - Load a scikit-learn / joblib model:
            import joblib
            model = joblib.load("model.pkl")
            X = [[features[k] for k in FEATURE_ORDER]]
            label = model.predict(X)[0]

      - Load a PyTorch / TensorFlow model and run inference

      - Call an external API

    The function must return a dict — this is sent directly to the app UI.
    ──────────────────────────────────────────────────────────────────────────
    """

    # ── PLACEHOLDER HEURISTIC (replace with real model) ───────────────────
    score = 0.0

    # High keystroke variance → more cognitive load
    score += min(features["std_keystrokes_per_sec"] * 5, 30)

    # Longer key hold = more hesitation = higher load
    score += min(features["mean_key_hold_ms"] / 20, 20)

    # Erratic mouse speed = higher load
    score += min(features["std_mouse_speed"] / 50, 20)

    # High click rate can indicate frustration
    score += min(features["total_mouse_clicks"] * 1.5, 15)

    # Low keystroke rate but high mouse movement = searching/distracted
    if features["mean_keystrokes_per_sec"] < 1 and features["mean_mouse_movements"] > 20:
        score += 15

    score = min(max(score, 0), 100)

    if score < 33:
        level = "LOW"
        description = "Minimal cognitive effort detected. Task appears routine."
    elif score < 66:
        level = "MEDIUM"
        description = "Moderate cognitive load. Normal engaged working state."
    else:
        level = "HIGH"
        description = "High cognitive load detected. Consider a short break."

    return {
        "cognitive_load_level": level,
        "cognitive_load_score": round(score, 1),
        "description": description,
        "features_used": features,
    }
    # ── END PLACEHOLDER ────────────────────────────────────────────────────


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
        batch = data.get("batch", [])

        if not batch:
            print(json.dumps({"error": "Empty batch received"}))
            sys.exit(0)

        features = extract_features(batch)
        result = predict(features)
        print(json.dumps(result))

    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"JSON parse error: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Model error: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()

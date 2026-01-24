const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

const csvPath = path.join(__dirname, "data", "keystroke_dataset.csv");

// Create CSV with correct header if not exists
if (!fs.existsSync(csvPath)) {
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });

    fs.writeFileSync(
        csvPath,
        "session_id,task_type,avg_hold_time,std_hold_time,avg_DD,avg_UD,pause_count,avg_pause_duration,backspace_rate,typing_speed_variance,stress_label,difficulty_rating\n"
    );
}

// API to save features
app.post("/api/save-data", (req, res) => {
    try {
        const rows = req.body;

        rows.forEach(r => {
            const line = [
                r.session_id,
                r.task_type,
                r.avgHoldTime,
                r.stdHoldTime,
                r.avgDD,
                r.avgUD,
                r.pauseCount,
                r.avgPauseDuration,
                r.backspaceRate,
                r.typingSpeedVariance,
                r.stress_label,
                r.difficulty_rating
            ].join(",");

            fs.appendFileSync(csvPath, line + "\n");
        });

        res.json({ status: "success" });
    } catch (error) {
        console.error("CSV write error:", error);
        res.status(500).json({ status: "error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

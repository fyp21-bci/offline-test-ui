# SSVEP Lane Game — Godot 4.x

An EEG-driven 2D lane game where the player moves left/right based on SSVEP
classifications from a BrainFlow backend.

## Requirements

| Dependency | Version |
|---|---|
| Godot | 4.2+ |
| Backend | `http://localhost:8000` (SSVEP questionnaire API) |

---

## Project Structure

```
ssvep_lane_game/
├── project.godot          ← Godot project config (VSync on, 60 fps cap)
├── scenes/
│   └── Main.tscn          ← Single scene: Game + UI
└── scripts/
    ├── Main.gd            ← Root controller (timer, decision loop, flicker)
    ├── Player.gd          ← 3-lane movement with tween
    ├── EEGClient.gd       ← HTTP client (start + poll)
    └── FlickerController.gd ← Standalone flicker utility (reference)
```

---

## Flicker System

| Arrow | Frequency | Method | Duty Cycle |
|---|---|---|---|
| Left ◀ | ~10 Hz | 6-frame cycle (3 ON / 3 OFF) | **50%** exact |
| Right ▶ | 12 Hz | 10-frame superperiod (3+2 ON / 5+5) | **50%** average |

- **Strictly frame-count based** — no timers, no delta accumulation
- `_frame_count` is incremented once per `_process()` call in `Main.gd`
- Assumes **60 Hz VSync display** (enforced via project settings)

---

## API Endpoints Used

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/stream/questionnaire/start` | Begin 5s EEG recording |
| GET | `/stream/questionnaire/result` | Poll for majority-voted frequency |

### Start body
```json
{
  "board_id": -1,
  "recording_length": 5.0,
  "candidate_frequencies": [10.0, 12.0]
}
```

### Result response
```json
{
  "done": true,
  "result": { "majority_frequency": 8.0 }
}
```

---

## Game Loop

```
Start
  │
  ├─ [every 8 s] → Decision Phase
  │     ├─ Enable flicker (8 Hz left, 12 Hz right)
  │     ├─ POST /start  → record 5 s of EEG
  │     ├─ Poll every 500 ms
  │     ├─ On result → disable flicker → move player
  │     └─ Schedule next decision in 8 s
  │
  └─ [at 60 s] → End Game overlay
```

---

## Project Settings (already set in project.godot)

```
Display → Window → VSync = Enabled
Application → Run → Max FPS = 60
```

---

## Opening in Godot

1. Open Godot 4 editor
2. **Import → Browse** → select `ssvep_lane_game/project.godot`
3. Press **F5** or click ▶ to run
4. Ensure `http://localhost:8000` backend is running before playing

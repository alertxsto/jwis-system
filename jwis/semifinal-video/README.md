# JWIS Semifinal Video Kit

This folder is the production source of truth for the AI Open Innovation Challenge 2026 semifinal prototype video.

## Before Anything Else

1. Open `cards.html` in a text editor.
2. Replace every `[TEAM NAME — REQUIRED]` and member placeholder in `VIDEO_CONFIG`.
3. Confirm that the case provider name matches the registered competition case.

## Prepare Each Recording Take

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\ai open presu lomba\jwis-winning-system\semifinal-video\prepare-recording.ps1"
```

This starts missing local services, resets dispatch state, checks API health, and prints the recording URLs.

Opening and closing cards are served at `http://localhost:5190/cards.html`.

## Production Files

- `cards.html`: 16:9 opening and closing cards. Press `1` for opening and `2` for closing.
- `NARRATION_SCRIPT_EN.md`: complete English human-narration script.
- `SHOT_LIST.md`: exact screen action for each section.
- `SUBMISSION_CHECKLIST.md`: mandatory guideline compliance and upload checks.
- `PRODUCTION_PLAN.md`: day-by-day plan through 17 July 2026.
- `assets/official-guidelines.png`: official guideline image supplied by the committee/user, used for the required logo strip.

## Recommended Capture Settings

- Canvas: 1920×1080
- Frame rate: 30 fps
- Browser zoom: 90-100%, chosen before recording and kept consistent
- Final format: MP4, H.264 video, AAC audio
- Target runtime: 08:15-09:00
- Narration: human English voice only

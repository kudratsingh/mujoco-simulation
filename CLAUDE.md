# physical-ai-foundations

Physical-AI foundations and a public report hub spanning control, ROS systems,
and manipulation-learning investigations. Main contains Week-1 foundations plus
public documentation; later implementations remain in open feature PRs. See
`docs/CURRENT_STATE.md` before describing integration or research status.

## Layout
- `docs/` — public landing hub, current state, experiment ledger and pinned report manifest.
- `scripts/build_public_site.py` — standard-library publication from the exact research commit; no training.
- `notes/` — written-in-own-words theory notes (C-space, frames, SE(3))
- `math/` — NumPy rotation/transform functions (no library wrappers)
- `tests/` — pytest suite (transforms, MJCF model, simulate.py, pd_control.py); CI in `.github/workflows/tests.yml`
- `mujoco/` — one-joint MJCF model, `simulate.py` (Thu), `pd_control.py` (Fri), generated `logs/` and `media/`
- `ros2_ws/` — ROS 2 Jazzy package, Ubuntu only
- `architecture/` — Week-1 system map and review

## Commands
```bash
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python mujoco/simulate.py            # headless, prints + saves logs
.venv/bin/python mujoco/simulate.py --render   # saves mujoco/media/*
.venv/bin/mjpython mujoco/simulate.py --viewer # interactive, macOS needs mjpython
.venv/bin/python tests/test_transforms.py
.venv/bin/python -m pytest                     # full suite (fast); add -m slow / -m 'not slow' to filter
```

## Conventions
- Always `.venv/bin/python`, never system Python.
- Don't run `--viewer` in automated sessions (needs a display). Use `--duration N` if you must.
- Regenerate `mujoco/media/` and `mujoco/logs/` via the script, never by hand.
- No secrets. `.venv/` and CSV logs are git-ignored.

## Public status conventions
- Main and the implemented research snapshot are different trees; do not imply the feature stack is merged.
- Preserve archived protocols, results and caveats. Public summaries distinguish final success from validation-selected checkpoints and separate test reset lists.
- `docs/project.json` pins report provenance. Verify the live deployment when changing public-facing docs.
- Passing CI certifies contracts, not manipulation reliability or oral competency.

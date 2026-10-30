# physical-ai-foundations

Physical-AI foundations and a public report hub spanning control, ROS systems,
and manipulation-learning investigations. Main contains the foundations, arm/ROS labs, learning experiments and public
documentation. Historical experiment snapshots remain pinned for reproducibility. See
`docs/CURRENT_STATE.md` before describing integration or research status.

## Layout
- `docs/` — public landing hub, current state, experiment ledger and pinned report manifest.
- `scripts/build_public_site.py` — standard-library publication from the exact research commit; no training.
- `notes/` — written-in-own-words theory notes (C-space, frames, SE(3))
- `math/` — NumPy rotation/transform functions (no library wrappers)
- `tests/` — pytest suite (transforms, MJCF model, simulate.py, pd_control.py); CI in `.github/workflows/tests.yml`
- `mujoco/` — one-joint MJCF model, `simulate.py` (Thu), `pd_control.py` (Fri), generated `logs/` and `media/`
- `ros2_ws/` — ROS 2 Jazzy package, Ubuntu 24.04 via Docker Desktop; see its README
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
- Use `.venv/bin/python` for Mac/MuJoCo work. ROS uses Ubuntu's `python3` inside
  the Jazzy container after sourcing ROS and the colcon workspace; never install
  ROS into the Mac venv.
- Use feature branches and PRs, worktrees when parallel changes need isolation,
  and appropriate tests. Implement requested work directly; explain it for review.
- Don't run `--viewer` in automated sessions (needs a display). Use `--duration N` if you must.
- Regenerate `mujoco/media/` and `mujoco/logs/` via the script, never by hand.
- No secrets. `.venv/` and CSV logs are git-ignored.

## Public status conventions
- Main includes the integrated research stack; distinguish current code from the original pinned evidence snapshot.
- Preserve archived protocols, results and caveats. Public summaries distinguish final success from validation-selected checkpoints and separate test reset lists.
- `docs/project.json` pins report provenance. Verify the live deployment when changing public-facing docs.
- Passing CI certifies contracts, not manipulation reliability or oral competency.

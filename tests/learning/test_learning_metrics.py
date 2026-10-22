"""Evaluation math: distinguish temporary success from success at episode end."""

import pytest
from learning.maniskill.metrics import summarize, wilson_interval


def test_success_definitions_and_uncertainty():
    episodes = [
        dict(
            seed=10000,
            **{"return": 10},
            steps=50,
            success_once=True,
            success_at_end=False,
        ),
        dict(
            seed=10001,
            **{"return": 4},
            steps=50,
            success_once=False,
            success_at_end=False,
        ),
    ]
    s = summarize(episodes)
    assert s["success_once_rate"] == 0.5
    assert s["success_at_end_rate"] == 0
    assert s["return_mean"] == 7
    assert s["success_once_95pct_wilson"][0] < 0.5 < s["success_once_95pct_wilson"][1]
    assert wilson_interval(0, 20)[1] > 0
    assert wilson_interval(20, 20)[0] < 1


def test_rejects_empty_duplicate_or_nonfinite_evaluation():
    with pytest.raises(ValueError):
        summarize([])
    e = dict(
        seed=1, **{"return": 1}, steps=50, success_once=False, success_at_end=False
    )
    with pytest.raises(ValueError, match="unique"):
        summarize([e, e])
    with pytest.raises(ValueError, match="finite"):
        summarize([{**e, "return": float("nan")}])

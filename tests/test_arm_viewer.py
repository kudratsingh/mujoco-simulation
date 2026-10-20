"""Test the actual local HTTP interface used by the angle sliders."""
from http.server import ThreadingHTTPServer
import json
import threading
from urllib.error import HTTPError
from urllib.request import urlopen

import numpy as np
import pytest

from arm_viewer import ArmHandler


@pytest.fixture
def viewer_url():
    server = ThreadingHTTPServer(("127.0.0.1", 0), ArmHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_page_and_bent_pose(viewer_url):
    with urlopen(viewer_url, timeout=3) as page:
        assert page.status == 200
        assert 'id="q1"' in page.read().decode()
    with urlopen(f"{viewer_url}/api/pose?q1=0&q2=90", timeout=3) as response:
        payload = json.load(response)
    assert np.allclose(payload["positions"][-1], [1, 0.75])
    assert payload["hand_heading_deg"] == 90
    assert np.allclose(np.linalg.multi_dot(payload["chain"]), payload["transform"])


@pytest.mark.parametrize("query", ["q1=nan", "q2=inf", "q1=181", "q2=-181",
                                   "q1=hello", "q1=", "q1=0&q1=90"])
def test_bad_angles_have_clear_client_errors(viewer_url, query):
    with pytest.raises(HTTPError) as error:
        urlopen(f"{viewer_url}/api/pose?{query}", timeout=3)
    assert error.value.code == 400
    assert "error" in json.load(error.value)


def test_unrecognized_path_cannot_read_local_files(viewer_url):
    with pytest.raises(HTTPError) as error:
        urlopen(f"{viewer_url}/../requirements.txt", timeout=3)
    assert error.value.code == 404

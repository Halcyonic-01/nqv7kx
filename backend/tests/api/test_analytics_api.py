import pytest
from fastapi.testclient import TestClient

from beaufort.api.app import create_app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(create_app())


def test_meta(client: TestClient) -> None:
    body = client.get("/api/v1/meta").json()
    assert body["coverage"] == {"first": "2026-01-02", "last": "2026-02-01"}
    assert body["default_gate_closure"] == "09:20"
    assert body["snapshot"]["rows"] == {"wind_forecast": 20440, "wind_actual": 1632}


def test_day_ahead_shape_and_utc_timestamps(client: TestClient) -> None:
    r = client.get("/api/v1/day-ahead", params={"delivery_date": "2026-01-12"})
    assert r.status_code == 200
    body = r.json()
    assert body["window"] == {"start": "2026-01-11T23:00:00Z", "end": "2026-01-12T23:00:00Z"}
    assert body["gate_closure"] == "2026-01-11T09:20:00Z"
    assert body["points"][0]["start"] == "2026-01-11T23:00:00Z"
    assert set(body["points"][0]) >= {"forecast_mw", "actual_mw", "error_mw", "band_low_mw"}


def test_gate_closure_param_changes_run(client: TestClient) -> None:
    body = client.get(
        "/api/v1/day-ahead", params={"delivery_date": "2026-01-12", "gate_closure": "09:50"}
    ).json()
    assert body["run_used"]["publish_time"] == "2026-01-11T09:30:00Z"


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/api/v1/day-ahead", {"delivery_date": "2026-01-01"}),
        ("/api/v1/day-ahead", {"delivery_date": "2026-01-12", "gate_closure": "9:20"}),
        ("/api/v1/day-ahead/runs", {"delivery_date": "2026-02-02"}),
        ("/api/v1/accuracy", {"from": "2026-01-20", "to": "2026-01-10"}),
        ("/api/v1/accuracy/lead-time", {"max_h": 99}),
    ],
)
def test_bad_requests_are_problem_json(
    client: TestClient, path: str, params: dict[str, str]
) -> None:
    r = client.get(path, params=params)
    assert r.status_code == 422
    assert r.headers["content-type"] == "application/problem+json"
    assert r.json()["status"] == 422


def test_accuracy_range_and_lead_time(client: TestClient) -> None:
    acc = client.get("/api/v1/accuracy", params={"from": "2026-01-10", "to": "2026-01-16"}).json()
    assert acc["daily"][0]["delivery_date"] == "2026-01-10"
    assert len(acc["daily"]) == 7
    lead = client.get("/api/v1/accuracy/lead-time", params={"max_h": 12}).json()
    assert [r["horizon_h"] for r in lead["rows"]] == list(range(13))


def test_responses_are_cacheable_with_etag(client: TestClient) -> None:
    r = client.get("/api/v1/meta")
    etag = r.headers["etag"]
    assert "s-maxage" in r.headers["cache-control"]
    assert client.get("/api/v1/meta", headers={"If-None-Match": etag}).status_code == 304
    assert "etag" not in client.get("/api/v1/health").headers

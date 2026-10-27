import platform

from fastapi.testclient import TestClient

from beaufort import __version__
from beaufort.api.app import create_app

client = TestClient(create_app())


def test_health_reports_ok_with_version() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "version": __version__,
        "python": platform.python_version(),
    }


def test_openapi_is_served_under_api_prefix() -> None:
    response = client.get("/api/openapi.json")

    assert response.status_code == 200
    assert "/api/v1/health" in response.json()["paths"]

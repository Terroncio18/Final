from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_answers_with_the_version() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "0.1.0"}


def test_the_api_is_versioned_in_the_path() -> None:
    """A deployed frontend keeps working when v2 appears beside v1."""
    assert client.get("/health").status_code == 404

import importlib
import sqlite3
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
BACKEND_APP = ROOT / "backend" / "app"
if str(BACKEND_APP) not in sys.path:
    sys.path.insert(0, str(BACKEND_APP))


@pytest.fixture()
def app_client(tmp_path, monkeypatch):
    db_path = tmp_path / "test_webmsh.sqlite3"

    db = importlib.import_module("db")
    auth = importlib.import_module("auth")
    projects = importlib.import_module("projects")
    main = importlib.import_module("main")

    def temp_connect_db():
        conn = sqlite3.connect(db_path, timeout=30, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    monkeypatch.setattr(db, "connect_db", temp_connect_db)
    monkeypatch.setattr(auth, "connect_db", temp_connect_db)
    monkeypatch.setattr(projects, "connect_db", temp_connect_db)
    monkeypatch.setattr(main, "connect_db", temp_connect_db)
    monkeypatch.setattr(auth, "AUTH_DEBUG_OTP", True)

    with TestClient(main.app) as client:
        yield client

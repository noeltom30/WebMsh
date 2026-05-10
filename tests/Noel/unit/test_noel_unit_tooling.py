from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_noel_ut_001_playwright_config_exists():
    assert (ROOT / "frontend" / "playwright.config.ts").exists()


def test_noel_ut_002_vitest_config_exists():
    assert (ROOT / "frontend" / "vitest.config.js").exists()


def test_noel_ut_003_pytest_ini_exists():
    assert (ROOT / "pytest.ini").exists()


def test_noel_ut_004_test_requirements_exist():
    req = ROOT / "tests" / "requirements-test.txt"
    assert req.exists()
    assert "pytest" in req.read_text(encoding="utf-8")

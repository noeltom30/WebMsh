import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[3]
BACKEND_APP = ROOT / "backend" / "app"
if str(BACKEND_APP) not in sys.path:
    sys.path.insert(0, str(BACKEND_APP))

from project_models import BoxRequest, ProjectCreateRequest, SphereRequest  # noqa: E402


def test_dhimant_ut_001_project_name_trimmed():
    assert ProjectCreateRequest(name="  Dhimant  ").name == "Dhimant"


def test_dhimant_ut_002_project_name_blank_invalid():
    with pytest.raises(ValidationError):
        ProjectCreateRequest(name="   ")


def test_dhimant_ut_003_box_width_must_be_positive():
    with pytest.raises(ValidationError):
        BoxRequest(width=0, height=1, depth=1)


def test_dhimant_ut_004_sphere_radius_must_be_positive():
    with pytest.raises(ValidationError):
        SphereRequest(radius=-0.1)

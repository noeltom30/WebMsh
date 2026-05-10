import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BACKEND_APP = ROOT / "backend" / "app"
if str(BACKEND_APP) not in sys.path:
    sys.path.insert(0, str(BACKEND_APP))

import auth  # noqa: E402


def test_shravan_ut_001_password_min_length():
    issues = auth._password_policy_issues("short", "shravan@example.com")
    assert any("at least" in issue for issue in issues)


def test_shravan_ut_002_password_requires_uppercase():
    issues = auth._password_policy_issues("alllowercase123@", "shravan@example.com")
    assert any("uppercase" in issue.lower() for issue in issues)


def test_shravan_ut_003_password_hash_verify_roundtrip():
    hashed = auth._hash_password("ShravanPass@12345")
    assert auth._verify_password("ShravanPass@12345", hashed) is True
    assert auth._verify_password("WrongPass@123", hashed) is False


def test_shravan_ut_004_otp_pattern_validation():
    assert auth.OTP_PATTERN.match("123456")
    assert not auth.OTP_PATTERN.match("12345a")

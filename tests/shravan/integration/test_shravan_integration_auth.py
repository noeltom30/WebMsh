def test_shravan_it_001_signup_success(app_client):
    response = app_client.post("/auth/signup", json={"email": "shravan.it1@example.com", "password": "ShravanPass@12345"})
    assert response.status_code == 200
    assert response.json()["next"] == "verify_signup_otp"


def test_shravan_it_002_signup_duplicate_rejected(app_client):
    payload = {"email": "shravan.it2@example.com", "password": "ShravanPass@12345"}
    app_client.post("/auth/signup", json=payload)
    duplicate = app_client.post("/auth/signup", json=payload)
    assert duplicate.status_code == 409


def test_shravan_it_003_verify_signup_invalid_otp(app_client):
    payload = {"email": "shravan.it3@example.com", "password": "ShravanPass@12345"}
    app_client.post("/auth/signup", json=payload)
    verify = app_client.post("/auth/signup/verify", json={"email": payload["email"], "code": "000000"})
    assert verify.status_code == 400


def test_shravan_it_004_signin_unverified_requires_signup_otp(app_client):
    payload = {"email": "shravan.it4@example.com", "password": "ShravanPass@12345"}
    app_client.post("/auth/signup", json=payload)
    signin = app_client.post("/auth/signin", json=payload)
    assert signin.status_code == 200
    assert signin.json()["next"] == "verify_signup_otp"


def test_shravan_it_005_signin_invalid_password(app_client):
    payload = {"email": "shravan.it5@example.com", "password": "ShravanPass@12345"}
    signup = app_client.post("/auth/signup", json=payload)
    app_client.post("/auth/signup/verify", json={"email": payload["email"], "code": signup.json()["dev_otp"]})
    signin = app_client.post("/auth/signin", json={"email": payload["email"], "password": "Wrong@12345"})
    assert signin.status_code == 401

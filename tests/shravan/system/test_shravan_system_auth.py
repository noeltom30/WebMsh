def _login(client, email: str):
    password = "ShravanPass@12345"
    signup = client.post("/auth/signup", json={"email": email, "password": password})
    client.post("/auth/signup/verify", json={"email": email, "code": signup.json()["dev_otp"]})
    signin = client.post("/auth/signin", json={"email": email, "password": password})
    client.post("/auth/signin/otp", json={"email": email, "code": signin.json()["dev_otp"]})


def test_shravan_st_001_authenticated_me(app_client):
    _login(app_client, "shravan.st1@example.com")
    assert app_client.get("/auth/me").status_code == 200


def test_shravan_st_002_logout_invalidates_session(app_client):
    _login(app_client, "shravan.st2@example.com")
    assert app_client.post("/auth/logout").status_code == 200
    assert app_client.get("/auth/me").status_code == 401


def test_shravan_st_003_protected_projects_requires_auth(app_client):
    assert app_client.get("/projects").status_code == 401


def test_shravan_st_004_profile_requires_auth(app_client):
    assert app_client.get("/auth/profile").status_code == 401

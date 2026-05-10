def _auth(client, email):
    password = "NoelPass@12345"
    signup = client.post("/auth/signup", json={"email": email, "password": password})
    client.post("/auth/signup/verify", json={"email": email, "code": signup.json()["dev_otp"]})
    signin = client.post("/auth/signin", json={"email": email, "password": password})
    client.post("/auth/signin/otp", json={"email": email, "code": signin.json()["dev_otp"]})


def test_noel_st_001_health_endpoint_ok(app_client):
    response = app_client.get("/health")
    assert response.status_code == 200 and response.json()["status"] == "ok"


def test_noel_st_002_end_to_end_profile_and_info(app_client):
    _auth(app_client, "noel.st2@example.com")
    assert app_client.get("/auth/profile").status_code == 200
    assert app_client.get("/info").status_code == 200


def test_noel_st_003_create_delete_project_system_flow(app_client):
    _auth(app_client, "noel.st3@example.com")
    created = app_client.post("/projects", json={"name": "SystemFlow"}).json()
    assert app_client.delete(f"/projects/{created['id']}").status_code == 200


def test_noel_st_004_password_change_request_requires_auth(app_client):
    response = app_client.post(
        "/auth/password/change/request",
        json={"old_password": "x", "new_password": "NewStrongPass@12345"},
    )
    assert response.status_code == 401

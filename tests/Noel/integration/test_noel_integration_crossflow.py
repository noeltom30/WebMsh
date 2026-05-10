def _auth(client, email):
    password = "NoelPass@12345"
    signup = client.post("/auth/signup", json={"email": email, "password": password})
    client.post("/auth/signup/verify", json={"email": email, "code": signup.json()["dev_otp"]})
    signin = client.post("/auth/signin", json={"email": email, "password": password})
    client.post("/auth/signin/otp", json={"email": email, "code": signin.json()["dev_otp"]})


def test_noel_it_001_auth_then_create_project(app_client):
    _auth(app_client, "noel.it1@example.com")
    assert app_client.post("/projects", json={"name": "Noel Project"}).status_code == 201


def test_noel_it_002_info_reflects_project_creation(app_client):
    _auth(app_client, "noel.it2@example.com")
    app_client.post("/projects", json={"name": "Noel Count"})
    info = app_client.get("/info")
    assert info.status_code == 200 and info.json()["project_count"] >= 1


def test_noel_it_003_logout_then_projects_unauthorized(app_client):
    _auth(app_client, "noel.it3@example.com")
    app_client.post("/auth/logout")
    assert app_client.get("/projects").status_code == 401


def test_noel_it_004_auth_config_endpoint_contract(app_client):
    response = app_client.get("/auth/config")
    assert response.status_code == 200 and "google_configured" in response.json()


def test_noel_it_005_root_endpoint_contract(app_client):
    response = app_client.get("/")
    assert response.status_code == 200 and "docs" in response.json()

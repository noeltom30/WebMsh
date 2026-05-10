def _auth(client, email):
    password = "DhimantPass@12345"
    signup = client.post("/auth/signup", json={"email": email, "password": password})
    client.post("/auth/signup/verify", json={"email": email, "code": signup.json()["dev_otp"]})
    signin = client.post("/auth/signin", json={"email": email, "password": password})
    client.post("/auth/signin/otp", json={"email": email, "code": signin.json()["dev_otp"]})


def test_dhimant_st_001_info_project_count_updates(app_client):
    _auth(app_client, "dhimant.st1@example.com")
    app_client.post("/projects", json={"name": "Count A"})
    info = app_client.get("/info")
    assert info.status_code == 200 and info.json()["project_count"] >= 1


def test_dhimant_st_002_project_detail_contains_geometries_array(app_client):
    _auth(app_client, "dhimant.st2@example.com")
    created = app_client.post("/projects", json={"name": "Detail Check"}).json()
    detail = app_client.get(f"/projects/{created['id']}")
    assert detail.status_code == 200 and isinstance(detail.json()["geometries"], list)


def test_dhimant_st_003_empty_geometry_list_is_valid(app_client):
    _auth(app_client, "dhimant.st3@example.com")
    created = app_client.post("/projects", json={"name": "No Geometry"}).json()
    response = app_client.get(f"/projects/{created['id']}/geometry")
    assert response.status_code == 200 and response.json() == []


def test_dhimant_st_004_deleted_project_unavailable(app_client):
    _auth(app_client, "dhimant.st4@example.com")
    created = app_client.post("/projects", json={"name": "Will Delete"}).json()
    app_client.delete(f"/projects/{created['id']}")
    assert app_client.get(f"/projects/{created['id']}").status_code == 404

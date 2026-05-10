def _auth(client, email):
    password = "DhimantPass@12345"
    signup = client.post("/auth/signup", json={"email": email, "password": password})
    client.post("/auth/signup/verify", json={"email": email, "code": signup.json()["dev_otp"]})
    signin = client.post("/auth/signin", json={"email": email, "password": password})
    client.post("/auth/signin/otp", json={"email": email, "code": signin.json()["dev_otp"]})


def test_dhimant_it_001_create_project(app_client):
    _auth(app_client, "dhimant.it1@example.com")
    assert app_client.post("/projects", json={"name": "Dhimant Project"}).status_code == 201


def test_dhimant_it_002_list_projects_contains_created(app_client):
    _auth(app_client, "dhimant.it2@example.com")
    app_client.post("/projects", json={"name": "Dhimant Project"})
    listed = app_client.get("/projects")
    assert listed.status_code == 200 and len(listed.json()) == 1


def test_dhimant_it_003_rename_project(app_client):
    _auth(app_client, "dhimant.it3@example.com")
    created = app_client.post("/projects", json={"name": "Old Name"}).json()
    renamed = app_client.patch(f"/projects/{created['id']}", json={"name": "New Name"})
    assert renamed.status_code == 200 and renamed.json()["name"] == "New Name"


def test_dhimant_it_004_delete_project(app_client):
    _auth(app_client, "dhimant.it4@example.com")
    created = app_client.post("/projects", json={"name": "Delete Me"}).json()
    assert app_client.delete(f"/projects/{created['id']}").status_code == 200


def test_dhimant_it_005_invalid_project_id_404(app_client):
    _auth(app_client, "dhimant.it5@example.com")
    assert app_client.get("/projects/9999").status_code == 404

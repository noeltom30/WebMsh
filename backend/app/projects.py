import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

try:
    from .auth import AuthUser, get_current_user
    from .db import connect_db
    from .mesh_service import (
        SUPPORTED_UPLOAD_EXTENSIONS,
        build_box_mesh,
        build_cylinder_mesh,
        build_mesh_from_cad,
        build_sphere_mesh,
        gmsh_available,
    )
    from .project_models import (
        BoxRequest,
        CylinderRequest,
        GeometryRecord,
        ProjectCreateRequest,
        ProjectDetail,
        ProjectRenameRequest,
        ProjectSummary,
        SphereRequest,
    )
    from .project_service import (
        create_geometry,
        create_project,
        delete_geometry,
        delete_project,
        get_project_detail,
        init_project_db,
        list_project_geometries,
        list_projects,
        rename_project,
    )
except ImportError:
    from auth import AuthUser, get_current_user
    from db import connect_db
    from mesh_service import (
        SUPPORTED_UPLOAD_EXTENSIONS,
        build_box_mesh,
        build_cylinder_mesh,
        build_mesh_from_cad,
        build_sphere_mesh,
        gmsh_available,
    )
    from project_models import (
        BoxRequest,
        CylinderRequest,
        GeometryRecord,
        ProjectCreateRequest,
        ProjectDetail,
        ProjectRenameRequest,
        ProjectSummary,
        SphereRequest,
    )
    from project_service import (
        create_geometry,
        create_project,
        delete_geometry,
        delete_project,
        get_project_detail,
        init_project_db,
        list_project_geometries,
        list_projects,
        rename_project,
    )


router = APIRouter(tags=["projects"])


def initialize_project_schema() -> None:
    with connect_db() as conn:
        init_project_db(conn)


@router.get("/projects", response_model=list[ProjectSummary])
def get_projects(current_user: AuthUser = Depends(get_current_user)):
    with connect_db() as conn:
        return list_projects(conn, current_user.id)


@router.post("/projects", response_model=ProjectSummary, status_code=201)
def post_project(body: ProjectCreateRequest, current_user: AuthUser = Depends(get_current_user)):
    with connect_db() as conn:
        return create_project(conn, current_user.id, body.name)


@router.get("/projects/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, current_user: AuthUser = Depends(get_current_user)):
    with connect_db() as conn:
        return get_project_detail(conn, current_user.id, project_id, touch_last_opened=True)


@router.patch("/projects/{project_id}", response_model=ProjectSummary)
def patch_project(
    project_id: int,
    body: ProjectRenameRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    with connect_db() as conn:
        return rename_project(conn, current_user.id, project_id, body.name)


@router.delete("/projects/{project_id}", response_model=ProjectSummary)
def remove_project(project_id: int, current_user: AuthUser = Depends(get_current_user)):
    with connect_db() as conn:
        return delete_project(conn, current_user.id, project_id)


@router.get("/projects/{project_id}/geometry", response_model=list[GeometryRecord])
def get_project_geometry(project_id: int, current_user: AuthUser = Depends(get_current_user)):
    with connect_db() as conn:
        return list_project_geometries(conn, current_user.id, project_id)


@router.delete("/projects/{project_id}/geometry/{geometry_id}", response_model=GeometryRecord)
def remove_project_geometry(
    project_id: int,
    geometry_id: int,
    current_user: AuthUser = Depends(get_current_user),
):
    with connect_db() as conn:
        return delete_geometry(conn, current_user.id, project_id, geometry_id)


@router.post("/projects/{project_id}/geometry/box", response_model=GeometryRecord)
def post_box(
    project_id: int,
    body: BoxRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = build_box_mesh(
        body.width,
        body.depth,
        body.height,
        body.origin_x,
        body.origin_y,
        body.origin_z,
    )

    with connect_db() as conn:
        return create_geometry(conn, current_user.id, project_id, "box", body.model_dump(), mesh)


@router.post("/projects/{project_id}/geometry/sphere", response_model=GeometryRecord)
def post_sphere(
    project_id: int,
    body: SphereRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = build_sphere_mesh(body.radius, body.center_x, body.center_y, body.center_z)

    with connect_db() as conn:
        return create_geometry(conn, current_user.id, project_id, "sphere", body.model_dump(), mesh)


@router.post("/projects/{project_id}/geometry/cylinder", response_model=GeometryRecord)
def post_cylinder(
    project_id: int,
    body: CylinderRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = build_cylinder_mesh(body.radius, body.height, body.base_x, body.base_y, body.base_z)

    with connect_db() as conn:
        return create_geometry(conn, current_user.id, project_id, "cylinder", body.model_dump(), mesh)


@router.post("/projects/{project_id}/geometry/upload", response_model=GeometryRecord)
async def post_upload(
    project_id: int,
    file: UploadFile = File(...),
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    filename = file.filename or "cad_file"
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext not in SUPPORTED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported format. Use STEP, IGES, BREP, STL, VTK, or MSH.",
        )

    tmp_path: Path | None = None
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp.write(content)
            tmp_path = Path(tmp.name)

        mesh = build_mesh_from_cad(tmp_path)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Meshing failed: {exc}")
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

    with connect_db() as conn:
        return create_geometry(
            conn,
            current_user.id,
            project_id,
            "upload",
            {"filename": filename, "ext": ext},
            mesh,
        )

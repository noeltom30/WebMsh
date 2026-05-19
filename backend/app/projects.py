import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

try:
    from .auth import AuthUser, get_current_user
    from .db import connect_db
    from .mesh_service import (
        SUPPORTED_EXPORT_FORMATS,
        SUPPORTED_UPLOAD_EXTENSIONS,
        build_box_mesh,
        build_circle_sketch_mesh,
        build_cylinder_mesh,
        build_extruded_sketch_mesh,
        build_mesh_from_cad,
        build_polygon_sketch_mesh,
        build_rectangle_sketch_mesh,
        build_revolved_sketch_mesh,
        build_sphere_mesh,
        export_mesh_to_file,
        gmsh_available,
    )
    from .project_models import (
        BoxRequest,
        CircleSketchRequest,
        CylinderRequest,
        ExtrudeRequest,
        GeometryLabelsRequest,
        GeometryRecord,
        PolygonSketchRequest,
        ProjectCreateRequest,
        ProjectDetail,
        ProjectRenameRequest,
        ProjectSummary,
        RectangleSketchRequest,
        RevolveRequest,
        SphereRequest,
    )
    from .project_service import (
        create_geometry,
        create_project,
        delete_geometry,
        delete_project,
        get_geometry_record,
        get_project_detail,
        init_project_db,
        list_project_geometries,
        list_projects,
        rename_project,
        update_geometry_labels,
    )
except ImportError:
    from auth import AuthUser, get_current_user
    from db import connect_db
    from mesh_service import (
        SUPPORTED_EXPORT_FORMATS,
        SUPPORTED_UPLOAD_EXTENSIONS,
        build_box_mesh,
        build_circle_sketch_mesh,
        build_cylinder_mesh,
        build_extruded_sketch_mesh,
        build_mesh_from_cad,
        build_polygon_sketch_mesh,
        build_rectangle_sketch_mesh,
        build_revolved_sketch_mesh,
        build_sphere_mesh,
        export_mesh_to_file,
        gmsh_available,
    )
    from project_models import (
        BoxRequest,
        CircleSketchRequest,
        CylinderRequest,
        ExtrudeRequest,
        GeometryLabelsRequest,
        GeometryRecord,
        PolygonSketchRequest,
        ProjectCreateRequest,
        ProjectDetail,
        ProjectRenameRequest,
        ProjectSummary,
        RectangleSketchRequest,
        RevolveRequest,
        SphereRequest,
    )
    from project_service import (
        create_geometry,
        create_project,
        delete_geometry,
        delete_project,
        get_geometry_record,
        get_project_detail,
        init_project_db,
        list_project_geometries,
        list_projects,
        rename_project,
        update_geometry_labels,
    )


router = APIRouter(tags=["projects"])


def initialize_project_schema() -> None:
    with connect_db() as conn:
        init_project_db(conn)


# ─── Project CRUD ────────────────────────────────────────────────────────────

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


# ─── Geometry list/delete ────────────────────────────────────────────────────

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


# ─── Primitive geometry ──────────────────────────────────────────────────────

@router.post("/projects/{project_id}/geometry/box", response_model=GeometryRecord)
async def post_box(
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
        body.mesh_settings,
    )

    with connect_db() as conn:
        return create_geometry(conn, current_user.id, project_id, "box", body.model_dump(), mesh)


@router.post("/projects/{project_id}/geometry/sphere", response_model=GeometryRecord)
async def post_sphere(
    project_id: int,
    body: SphereRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = build_sphere_mesh(
        body.radius,
        body.center_x,
        body.center_y,
        body.center_z,
        body.mesh_settings,
    )

    with connect_db() as conn:
        return create_geometry(conn, current_user.id, project_id, "sphere", body.model_dump(), mesh)


@router.post("/projects/{project_id}/geometry/cylinder", response_model=GeometryRecord)
async def post_cylinder(
    project_id: int,
    body: CylinderRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = build_cylinder_mesh(
        body.radius,
        body.height,
        body.base_x,
        body.base_y,
        body.base_z,
        body.mesh_settings,
    )

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


# ─── 2D Sketch endpoints ─────────────────────────────────────────────────────

@router.post("/projects/{project_id}/geometry/sketch/rectangle", response_model=GeometryRecord)
async def post_sketch_rectangle(
    project_id: int,
    body: RectangleSketchRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    try:
        mesh = build_rectangle_sketch_mesh(
            body.width,
            body.height,
            body.origin_x,
            body.origin_y,
            body.z,
            body.mesh_settings,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sketch meshing failed: {exc}")

    with connect_db() as conn:
        return create_geometry(conn, current_user.id, project_id, "sketch_rectangle", body.model_dump(), mesh)


@router.post("/projects/{project_id}/geometry/sketch/circle", response_model=GeometryRecord)
async def post_sketch_circle(
    project_id: int,
    body: CircleSketchRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    try:
        mesh = build_circle_sketch_mesh(
            body.radius,
            body.center_x,
            body.center_y,
            body.z,
            body.mesh_settings,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sketch meshing failed: {exc}")

    with connect_db() as conn:
        return create_geometry(conn, current_user.id, project_id, "sketch_circle", body.model_dump(), mesh)


@router.post("/projects/{project_id}/geometry/sketch/polygon", response_model=GeometryRecord)
async def post_sketch_polygon(
    project_id: int,
    body: PolygonSketchRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    try:
        mesh = build_polygon_sketch_mesh(body.points, body.z, body.mesh_settings)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sketch meshing failed: {exc}")

    with connect_db() as conn:
        return create_geometry(conn, current_user.id, project_id, "sketch_polygon", body.model_dump(), mesh)


# ─── 3D Transform endpoints ──────────────────────────────────────────────────

@router.post("/projects/{project_id}/geometry/{geometry_id}/extrude", response_model=GeometryRecord)
async def post_extrude(
    project_id: int,
    geometry_id: int,
    body: ExtrudeRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    with connect_db() as conn:
        source = get_geometry_record(conn, current_user.id, project_id, geometry_id)
        if not source.type.startswith("sketch_"):
            raise HTTPException(status_code=400, detail="Extrude requires a 2D sketch geometry as source")

        try:
            mesh = build_extruded_sketch_mesh(source.type, source.params, body.height, body.mesh_settings)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Extrude failed: {exc}")

        params = {
            "source_geometry_id": geometry_id,
            "source_type": source.type,
            "height": body.height,
            **({"mesh_settings": body.mesh_settings.model_dump()} if body.mesh_settings else {}),
        }
        return create_geometry(conn, current_user.id, project_id, "extrude", params, mesh)


@router.post("/projects/{project_id}/geometry/{geometry_id}/revolve", response_model=GeometryRecord)
async def post_revolve(
    project_id: int,
    geometry_id: int,
    body: RevolveRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    with connect_db() as conn:
        source = get_geometry_record(conn, current_user.id, project_id, geometry_id)
        if not source.type.startswith("sketch_"):
            raise HTTPException(status_code=400, detail="Revolve requires a 2D sketch geometry as source")

        try:
            mesh = build_revolved_sketch_mesh(source.type, source.params, body.angle_degrees, body.mesh_settings)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Revolve failed: {exc}")

        params = {
            "source_geometry_id": geometry_id,
            "source_type": source.type,
            "angle_degrees": body.angle_degrees,
            **({"mesh_settings": body.mesh_settings.model_dump()} if body.mesh_settings else {}),
        }
        return create_geometry(conn, current_user.id, project_id, "revolve", params, mesh)


# ─── Export endpoint ─────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/geometry/{geometry_id}/export")
async def export_geometry(
    project_id: int,
    geometry_id: int,
    format: str = Query(default="msh", description="Export format: msh, stl, vtk, obj"),
    current_user: AuthUser = Depends(get_current_user),
):
    fmt = format.lower()
    if fmt not in SUPPORTED_EXPORT_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{fmt}'. Choose from: {', '.join(sorted(SUPPORTED_EXPORT_FORMATS))}",
        )

    with connect_db() as conn:
        record = get_geometry_record(conn, current_user.id, project_id, geometry_id)

    if record.mesh is None:
        raise HTTPException(status_code=404, detail="No mesh data found for this geometry")

    labels: list[str] = record.params.get("labels", [])

    try:
        file_path, media_type, filename = export_mesh_to_file(record.mesh, record.type, labels, fmt)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Export failed: {exc}")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        background=None,
    )


# ─── Labels endpoint ─────────────────────────────────────────────────────────

@router.patch("/projects/{project_id}/geometry/{geometry_id}/labels", response_model=GeometryRecord)
async def patch_geometry_labels(
    project_id: int,
    geometry_id: int,
    body: GeometryLabelsRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    with connect_db() as conn:
        return update_geometry_labels(conn, current_user.id, project_id, geometry_id, body.labels)

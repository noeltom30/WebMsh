import tempfile
import time
import threading
import secrets
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import FastAPI, HTTPException, File, UploadFile, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from typing import Literal

try:
    import gmsh  # type: ignore
except ImportError:
    gmsh = None


app = FastAPI(title="WebMsh API", version="0.1.0")

# Allow the Vite dev server to talk to the API while local.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BoxRequest(BaseModel):
    width: float = Field(gt=0, description="X dimension")
    depth: float = Field(gt=0, description="Y dimension")
    height: float = Field(gt=0, description="Z dimension")
    origin_x: float = Field(0, description="Box min corner X")
    origin_y: float = Field(0, description="Box min corner Y")
    origin_z: float = Field(0, description="Box min corner Z")


class SphereRequest(BaseModel):
    radius: float = Field(gt=0, description="Sphere radius")
    center_x: float = Field(0, description="Center X")
    center_y: float = Field(0, description="Center Y")
    center_z: float = Field(0, description="Center Z")


class CylinderRequest(BaseModel):
    radius: float = Field(gt=0, description="Cylinder radius")
    height: float = Field(gt=0, description="Cylinder height")
    base_x: float = Field(0, description="Base center X")
    base_y: float = Field(0, description="Base center Y")
    base_z: float = Field(0, description="Base center Z")


class MeshNode(BaseModel):
    id: int
    x: float
    y: float
    z: float


class Mesh(BaseModel):
    dimension: int = Field(default=2, ge=1, le=3)
    nodes: list[MeshNode]
    lines: list[list[int]] = Field(default_factory=list)
    triangles: list[list[int]] = Field(default_factory=list)
    tetrahedra: list[list[int]] = Field(default_factory=list)


class Geometry(BaseModel):
    id: int
    type: str
    params: dict
    mesh: Mesh | None = None


class BooleanRequest(BaseModel):
    operation: Literal["fuse", "cut", "intersect"]
    left_id: int = Field(gt=0, description="ID of the target/left geometry")
    right_id: int = Field(gt=0, description="ID of the tool/right geometry")


class MeshGenerationRequest(BaseModel):
    dimension: Literal[1, 2, 3]
    geometry_ids: list[int] | None = None


class MeshGenerationResponse(BaseModel):
    dimension: int
    updated_ids: list[int]
    geometries: list[Geometry]


class AuthSessionResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


@dataclass
class SessionState:
    token: str
    geometries: list[Geometry] = field(default_factory=list)
    last_active: float = field(default_factory=time.time)


_sessions: dict[str, SessionState] = {}
_sessions_lock = threading.RLock()
SESSION_IDLE_SECONDS = 30 * 60

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {"step", "stp", "iges", "igs", "brep", "stl", "vtk", "msh"}
ALLOWED_MIME_TYPES_BY_EXT = {
    "step": {"application/step", "model/step", "application/octet-stream"},
    "stp": {"application/step", "model/step", "application/octet-stream"},
    "iges": {"application/iges", "model/iges", "application/octet-stream"},
    "igs": {"application/iges", "model/iges", "application/octet-stream"},
    "brep": {"application/x-brep", "application/octet-stream"},
    "stl": {
        "model/stl",
        "application/sla",
        "application/vnd.ms-pki.stl",
        "application/octet-stream",
    },
    "vtk": {"application/x-vtk", "model/vtk", "text/plain", "application/octet-stream"},
    "msh": {"application/x-gmsh", "text/plain", "application/octet-stream"},
}


@app.get("/", tags=["system"])
async def root():
    return {"message": "WebMsh API is running", "docs": "/docs"}


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}


def _cleanup_idle_sessions(now: float | None = None):
    current = now if now is not None else time.time()
    stale_tokens = [
        token
        for token, session in _sessions.items()
        if (current - session.last_active) > SESSION_IDLE_SECONDS
    ]
    for token in stale_tokens:
        _sessions.pop(token, None)


def _parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Authorization must be Bearer <token>")
    return token.strip()


def _get_session_state(authorization: str | None = Header(default=None)) -> SessionState:
    token = _parse_bearer_token(authorization)
    now = time.time()
    with _sessions_lock:
        _cleanup_idle_sessions(now)
        session = _sessions.get(token)
        if session is None:
            raise HTTPException(status_code=401, detail="Invalid or expired access token")
        session.last_active = now
        return session


@app.post("/auth/session", tags=["auth"], response_model=AuthSessionResponse)
async def create_auth_session():
    token = secrets.token_urlsafe(32)
    with _sessions_lock:
        _cleanup_idle_sessions()
        _sessions[token] = SessionState(token=token)
    return AuthSessionResponse(access_token=token, expires_in=SESSION_IDLE_SECONDS)


@app.get("/info", tags=["system"])
async def info(state: SessionState = Depends(_get_session_state)):
    with _sessions_lock:
        _cleanup_idle_sessions()
        active_sessions = len(_sessions)

    return {
        "name": "WebMsh",
        "version": "0.1.0",
        "gmsh_available": _gmsh_available(),
        "geometry_count": len(state.geometries),
        "active_sessions": active_sessions,
    }


@app.get("/geometry", tags=["geometry"])
async def list_geometry(state: SessionState = Depends(_get_session_state)):
    return state.geometries


@app.delete("/geometry/{geom_id}", tags=["geometry"], response_model=Geometry)
async def delete_geometry(geom_id: int, state: SessionState = Depends(_get_session_state)):
    for idx, geom in enumerate(state.geometries):
        if geom.id == geom_id:
            return state.geometries.pop(idx)
    raise HTTPException(status_code=404, detail="Geometry not found")


@app.post("/geometry/box", tags=["geometry"], response_model=Geometry)
async def create_box(body: BoxRequest, state: SessionState = Depends(_get_session_state)):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = _build_box_mesh(body.width, body.depth, body.height, body.origin_x, body.origin_y, body.origin_z)

    new_id = _next_geometry_id(state.geometries)
    geom = Geometry(id=new_id, type="box", params=body.model_dump(), mesh=mesh)
    state.geometries.append(geom)
    return geom


@app.post("/geometry/sphere", tags=["geometry"], response_model=Geometry)
async def create_sphere(body: SphereRequest, state: SessionState = Depends(_get_session_state)):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = _build_sphere_mesh(body.radius, body.center_x, body.center_y, body.center_z)

    new_id = _next_geometry_id(state.geometries)
    geom = Geometry(id=new_id, type="sphere", params=body.model_dump(), mesh=mesh)
    state.geometries.append(geom)
    return geom


@app.post("/geometry/cylinder", tags=["geometry"], response_model=Geometry)
async def create_cylinder(body: CylinderRequest, state: SessionState = Depends(_get_session_state)):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = _build_cylinder_mesh(body.radius, body.height, body.base_x, body.base_y, body.base_z)

    new_id = _next_geometry_id(state.geometries)
    geom = Geometry(id=new_id, type="cylinder", params=body.model_dump(), mesh=mesh)
    state.geometries.append(geom)
    return geom


@app.post("/geometry/boolean", tags=["geometry"], response_model=Geometry)
async def create_boolean(body: BooleanRequest, state: SessionState = Depends(_get_session_state)):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    left = _get_geometry(state.geometries, body.left_id)
    right = _get_geometry(state.geometries, body.right_id)

    allowed = {"box", "sphere", "cylinder"}
    if left.type not in allowed or right.type not in allowed:
        raise HTTPException(status_code=400, detail="Boolean operations currently supported for box, sphere, and cylinder only")

    try:
        mesh = _build_boolean_mesh(body.operation, left, right)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    new_id = _next_geometry_id(state.geometries)
    params = {"operation": body.operation, "left": left.id, "right": right.id}
    geom = Geometry(id=new_id, type="boolean", params=params, mesh=mesh)
    state.geometries.append(geom)
    return geom


@app.post("/mesh/generate", tags=["mesh"], response_model=MeshGenerationResponse)
async def generate_mesh(body: MeshGenerationRequest, state: SessionState = Depends(_get_session_state)):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    if body.geometry_ids:
        target_ids = body.geometry_ids
    else:
        target_ids = [
            geom.id
            for geom in state.geometries
            if geom.type in {"box", "sphere", "cylinder", "boolean"}
        ]

    if not target_ids:
        raise HTTPException(status_code=400, detail="No geometries available for mesh generation")

    targets: list[Geometry] = []
    seen: set[int] = set()
    for geom_id in target_ids:
        geom = _get_geometry(state.geometries, geom_id)
        if geom.type not in {"box", "sphere", "cylinder", "boolean"}:
            raise HTTPException(status_code=422, detail=f"Geometry {geom.id} ({geom.type}) cannot be remeshed")
        if geom.id in seen:
            continue
        seen.add(geom.id)
        targets.append(geom)

    updated_ids: list[int] = []
    for geom in targets:
        try:
            geom.mesh = _build_geometry_mesh(geom, state.geometries, body.dimension)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Geometry {geom.id}: {exc}")
        updated_ids.append(geom.id)

    return MeshGenerationResponse(
        dimension=body.dimension,
        updated_ids=updated_ids,
        geometries=state.geometries,
    )


def _gmsh_available():
    return gmsh is not None


def _get_geometry(geometries: list[Geometry], geom_id: int) -> Geometry:
    for geom in geometries:
        if geom.id == geom_id:
            return geom
    raise HTTPException(status_code=404, detail=f"Geometry {geom_id} not found")


def _next_geometry_id(geometries: list[Geometry]) -> int:
    if not geometries:
        return 1
    return max(geom.id for geom in geometries) + 1


def _add_geom_to_occ(geom: Geometry):
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    if geom.type == "box":
        p = geom.params
        tag = gmsh.model.occ.addBox(p["origin_x"], p["origin_y"], p["origin_z"], p["width"], p["depth"], p["height"])
        return (3, tag)

    if geom.type == "sphere":
        p = geom.params
        tag = gmsh.model.occ.addSphere(p["center_x"], p["center_y"], p["center_z"], p["radius"])
        return (3, tag)

    if geom.type == "cylinder":
        p = geom.params
        tag = gmsh.model.occ.addCylinder(p["base_x"], p["base_y"], p["base_z"], 0.0, 0.0, p["height"], p["radius"])
        return (3, tag)

    raise ValueError(f"Geometry type '{geom.type}' is not supported for boolean operations")


def _add_geometry_recursive_to_occ(
    geom: Geometry,
    geometries_by_id: dict[int, Geometry],
    cache: dict[int, list[tuple[int, int]]],
) -> list[tuple[int, int]]:
    if geom.id in cache:
        return cache[geom.id]

    if geom.type in {"box", "sphere", "cylinder"}:
        result = [_add_geom_to_occ(geom)]
        cache[geom.id] = result
        return result

    if geom.type == "boolean":
        params = geom.params
        left_id = int(params.get("left", -1))
        right_id = int(params.get("right", -1))
        operation = str(params.get("operation", ""))

        left_geom = geometries_by_id.get(left_id)
        right_geom = geometries_by_id.get(right_id)
        if left_geom is None or right_geom is None:
            raise ValueError("Boolean geometry references missing operands")

        left_entities = _add_geometry_recursive_to_occ(left_geom, geometries_by_id, cache)
        right_entities = _add_geometry_recursive_to_occ(right_geom, geometries_by_id, cache)

        if operation == "fuse":
            out_entities, _ = gmsh.model.occ.fuse(left_entities, right_entities)
        elif operation == "cut":
            out_entities, _ = gmsh.model.occ.cut(left_entities, right_entities)
        elif operation == "intersect":
            out_entities, _ = gmsh.model.occ.intersect(left_entities, right_entities)
        else:
            raise ValueError(f"Unsupported boolean operation '{operation}'")

        if not out_entities:
            raise ValueError("Boolean operation produced no output entities")

        volumes = [ent for ent in out_entities if ent[0] == 3]
        result = volumes if volumes else out_entities
        cache[geom.id] = result
        return result

    raise ValueError(f"Geometry type '{geom.type}' cannot be reconstructed for remeshing")


def _build_geometry_mesh(geom: Geometry, geometries: list[Geometry], dimension: int) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    if geom.type not in {"box", "sphere", "cylinder", "boolean"}:
        raise ValueError(f"Geometry type '{geom.type}' is not supported for remeshing")

    gmsh.initialize([])
    try:
        gmsh.model.add(f"mesh-{geom.id}-d{dimension}")
        geometries_by_id = {g.id: g for g in geometries}
        _add_geometry_recursive_to_occ(geom, geometries_by_id, cache={})
        gmsh.model.occ.synchronize()
        gmsh.model.mesh.generate(dimension)
        return _extract_mesh_data(dimension)
    finally:
        gmsh.finalize()


def _build_boolean_mesh(operation: str, left: Geometry, right: Geometry) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.model.add("boolean")
        left_ent = _add_geom_to_occ(left)
        right_ent = _add_geom_to_occ(right)
        gmsh.model.occ.synchronize()

        if operation == "fuse":
            gmsh.model.occ.fuse([left_ent], [right_ent])
        elif operation == "cut":
            gmsh.model.occ.cut([left_ent], [right_ent])
        elif operation == "intersect":
            gmsh.model.occ.intersect([left_ent], [right_ent])
        else:
            raise ValueError(f"Unsupported operation '{operation}'")

        gmsh.model.occ.synchronize()
        gmsh.model.mesh.generate(2)
        return _extract_mesh_data(2)
    finally:
        gmsh.finalize()


@app.post("/geometry/upload", tags=["geometry"], response_model=Geometry)
async def upload_cad(file: UploadFile = File(...), state: SessionState = Depends(_get_session_state)):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    filename = file.filename or "cad_file"
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported format. Use STEP, IGES, BREP, STL, VTK, or MSH.")

    content_type = (file.content_type or "").lower()
    allowed_mimes = ALLOWED_MIME_TYPES_BY_EXT.get(ext, set())
    if not content_type or content_type not in allowed_mimes:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported MIME type '{content_type or 'missing'}' for .{ext}. "
                "Use a file with a matching format/content type."
            ),
        )

    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp_path = Path(tmp.name)
            total_size = 0
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Uploaded file exceeds 50 MB size limit")
                tmp.write(chunk)

            if total_size == 0:
                raise HTTPException(status_code=400, detail="Uploaded file is empty")
    except HTTPException:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)
        raise
    except Exception as exc:  # pragma: no cover - defensive
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to store upload: {exc}")

    try:
        mesh = _build_mesh_from_cad(tmp_path)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Meshing failed: {exc}")
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

    new_id = _next_geometry_id(state.geometries)
    geom = Geometry(id=new_id, type="cad", params={"filename": filename, "ext": ext}, mesh=mesh)
    state.geometries.append(geom)
    return geom


def _build_box_mesh(width: float, depth: float, height: float, origin_x: float, origin_y: float, origin_z: float) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.model.add("box")
        gmsh.model.occ.addBox(origin_x, origin_y, origin_z, width, depth, height)
        gmsh.model.occ.synchronize()
        gmsh.model.mesh.generate(2)
        return _extract_mesh_data(2)
    finally:
        gmsh.finalize()


def _build_sphere_mesh(radius: float, cx: float, cy: float, cz: float) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.model.add("sphere")
        gmsh.model.occ.addSphere(cx, cy, cz, radius)
        gmsh.model.occ.synchronize()
        gmsh.model.mesh.generate(2)

        return _extract_mesh_data(2)
    finally:
        gmsh.finalize()


def _build_cylinder_mesh(radius: float, height: float, bx: float, by: float, bz: float) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.model.add("cylinder")
        gmsh.model.occ.addCylinder(bx, by, bz, 0.0, 0.0, height, radius)
        gmsh.model.occ.synchronize()
        gmsh.model.mesh.generate(2)

        return _extract_mesh_data(2)
    finally:
        gmsh.finalize()


def _extract_nodes() -> list[MeshNode]:
    node_ids, node_coords, _ = gmsh.model.mesh.getNodes()
    return [
        MeshNode(
            id=int(node_ids[i]),
            x=float(node_coords[3 * i]),
            y=float(node_coords[3 * i + 1]),
            z=float(node_coords[3 * i + 2]),
        )
        for i in range(len(node_ids))
    ]


def _extract_surface_triangles() -> list[list[int]]:
    # Prefer surface elements; if missing, derive boundary from volume elements.
    elem_types, _, elem_node_tags = gmsh.model.mesh.getElements(dim=2)
    use_volume_fallback = False
    if not elem_types:
        elem_types, _, elem_node_tags = gmsh.model.mesh.getElements()
        use_volume_fallback = True

    triangles: list[list[int]] = []
    face_counts: dict[tuple[int, int, int], int] = {}
    face_orientations: dict[tuple[int, int, int], list[int]] = {}

    def add_surface_tri(a: int, b: int, c: int):
        triangles.append([int(a), int(b), int(c)])

    def add_volume_face(a: int, b: int, c: int):
        key = tuple(sorted((int(a), int(b), int(c))))
        face_counts[key] = face_counts.get(key, 0) + 1
        if key not in face_orientations:
            face_orientations[key] = [int(a), int(b), int(c)]

    for idx, etype in enumerate(elem_types):
        node_tags = elem_node_tags[idx]
        _, dim, _, num_nodes, _, num_primary = gmsh.model.mesh.getElementProperties(etype)
        stride = num_nodes or 0
        primary = num_primary or num_nodes
        if not stride or primary is None:
            continue

        if not use_volume_fallback and dim == 2 and primary == 3:
            for i in range(0, len(node_tags), stride):
                a, b, c = node_tags[i:i + 3]
                add_surface_tri(a, b, c)
            continue

        if not use_volume_fallback and dim == 2 and primary == 4:
            for i in range(0, len(node_tags), stride):
                a, b, c, d = node_tags[i:i + primary]
                add_surface_tri(a, b, c)
                add_surface_tri(a, c, d)
            continue

        # For volume-only meshes, retain only faces that appear exactly once.
        if use_volume_fallback and dim == 3:
            for i in range(0, len(node_tags), stride):
                corners = list(node_tags[i:i + primary])
                if len(corners) < primary:
                    continue

                if primary == 4:  # tetra (any order)
                    a, b, c, d = corners[:4]
                    add_volume_face(a, b, c)
                    add_volume_face(a, b, d)
                    add_volume_face(a, c, d)
                    add_volume_face(b, c, d)
                    continue

                if primary == 5:  # pyramid
                    a, b, c, d, e = corners[:5]
                    add_volume_face(a, b, c)
                    add_volume_face(a, c, d)
                    add_volume_face(a, b, e)
                    add_volume_face(b, c, e)
                    add_volume_face(c, d, e)
                    add_volume_face(d, a, e)
                    continue

                if primary == 6:  # prism/wedge
                    a, b, c, d, e, f = corners[:6]
                    add_volume_face(a, b, c)
                    add_volume_face(d, f, e)
                    quads = [(a, b, f, d), (b, c, e, f), (c, a, d, e)]
                    for q in quads:
                        q1, q2, q3, q4 = q
                        add_volume_face(q1, q2, q3)
                        add_volume_face(q1, q3, q4)
                    continue

                if primary == 8:  # hex
                    a, b, c, d, e, f, g, h = corners[:8]
                    faces = [
                        (a, b, c, d),
                        (e, f, g, h),
                        (a, b, f, e),
                        (b, c, g, f),
                        (c, d, h, g),
                        (d, a, e, h),
                    ]
                    for face in faces:
                        x, y, z, w = face
                        add_volume_face(x, y, z)
                        add_volume_face(x, z, w)
                    continue

                # Fallback: take first three nodes of the element chunk.
                if primary >= 3:
                    add_volume_face(corners[0], corners[1], corners[2])

    if use_volume_fallback:
        triangles = [
            face_orientations[key]
            for key, count in face_counts.items()
            if count == 1
        ]

    return triangles


def _extract_line_elements() -> list[list[int]]:
    elem_types, _, elem_node_tags = gmsh.model.mesh.getElements(dim=1)
    lines: list[list[int]] = []

    for idx, etype in enumerate(elem_types):
        node_tags = elem_node_tags[idx]
        _, dim, _, num_nodes, _, num_primary = gmsh.model.mesh.getElementProperties(etype)
        stride = num_nodes or 0
        primary = num_primary or num_nodes
        if dim != 1 or not stride or primary is None or primary < 2:
            continue

        for i in range(0, len(node_tags), stride):
            chunk = node_tags[i:i + primary]
            if len(chunk) >= 2:
                lines.append([int(chunk[0]), int(chunk[1])])

    return lines


def _extract_tetrahedra() -> list[list[int]]:
    elem_types, _, elem_node_tags = gmsh.model.mesh.getElements(dim=3)
    tetrahedra: list[list[int]] = []

    for idx, etype in enumerate(elem_types):
        node_tags = elem_node_tags[idx]
        _, dim, _, num_nodes, _, num_primary = gmsh.model.mesh.getElementProperties(etype)
        stride = num_nodes or 0
        primary = num_primary or num_nodes
        if dim != 3 or not stride or primary is None:
            continue

        # Capture tetrahedra (linear or higher-order) via primary corner nodes.
        if primary != 4:
            continue

        for i in range(0, len(node_tags), stride):
            a, b, c, d = node_tags[i:i + 4]
            tetrahedra.append([int(a), int(b), int(c), int(d)])

    return tetrahedra


def _extract_mesh_data(dimension: int) -> Mesh:
    nodes = _extract_nodes()
    lines: list[list[int]] = []
    triangles: list[list[int]] = []
    tetrahedra: list[list[int]] = []

    if dimension == 1:
        lines = _extract_line_elements()
    elif dimension == 2:
        triangles = _extract_surface_triangles()
    elif dimension == 3:
        tetrahedra = _extract_tetrahedra()
        triangles = _extract_surface_triangles()
    else:
        raise ValueError(f"Unsupported mesh dimension '{dimension}'")

    return Mesh(
        dimension=dimension,
        nodes=nodes,
        lines=lines,
        triangles=triangles,
        tetrahedra=tetrahedra,
    )


def _extract_surface_mesh() -> Mesh:
    return _extract_mesh_data(2)


def _build_mesh_from_cad(path: Path) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.open(str(path))
        entities = gmsh.model.getEntities()
        if not entities and len(gmsh.model.mesh.getNodes()[0]) == 0:
            raise ValueError("CAD/mesh file contains no entities or nodes")

        # If the file already contains a mesh, keep it. If it lacks surface elements, generate surface mesh.
        existing_node_ids, _, _ = gmsh.model.mesh.getNodes()
        surf_elem_types, _, _ = gmsh.model.mesh.getElements(dim=2)
        if len(existing_node_ids) == 0 or not surf_elem_types:
            gmsh.model.mesh.generate(2)
        return _extract_surface_mesh()
    finally:
        gmsh.finalize()


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
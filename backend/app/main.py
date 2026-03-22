import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, File, UploadFile
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
    nodes: list[MeshNode]
    triangles: list[list[int]]  # node ids triples


class Geometry(BaseModel):
    id: int
    type: str
    params: dict
    mesh: Mesh | None = None


class BooleanRequest(BaseModel):
    operation: Literal["fuse", "cut", "intersect"]
    left_id: int = Field(gt=0, description="ID of the target/left geometry")
    right_id: int = Field(gt=0, description="ID of the tool/right geometry")


_geometries: list[Geometry] = []


@app.get("/", tags=["system"])
async def root():
    return {"message": "WebMsh API is running", "docs": "/docs"}


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}


@app.get("/info", tags=["system"])
async def info():
    return {
        "name": "WebMsh",
        "version": "0.1.0",
        "gmsh_available": _gmsh_available(),
        "geometry_count": len(_geometries),
    }


@app.get("/geometry", tags=["geometry"])
async def list_geometry():
    return _geometries


@app.delete("/geometry/{geom_id}", tags=["geometry"], response_model=Geometry)
async def delete_geometry(geom_id: int):
    for idx, geom in enumerate(_geometries):
        if geom.id == geom_id:
            return _geometries.pop(idx)
    raise HTTPException(status_code=404, detail="Geometry not found")


@app.post("/geometry/box", tags=["geometry"], response_model=Geometry)
async def create_box(body: BoxRequest):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = _build_box_mesh(body.width, body.depth, body.height, body.origin_x, body.origin_y, body.origin_z)

    new_id = len(_geometries) + 1
    geom = Geometry(id=new_id, type="box", params=body.model_dump(), mesh=mesh)
    _geometries.append(geom)
    return geom


@app.post("/geometry/sphere", tags=["geometry"], response_model=Geometry)
async def create_sphere(body: SphereRequest):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = _build_sphere_mesh(body.radius, body.center_x, body.center_y, body.center_z)

    new_id = len(_geometries) + 1
    geom = Geometry(id=new_id, type="sphere", params=body.model_dump(), mesh=mesh)
    _geometries.append(geom)
    return geom


@app.post("/geometry/cylinder", tags=["geometry"], response_model=Geometry)
async def create_cylinder(body: CylinderRequest):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    mesh = _build_cylinder_mesh(body.radius, body.height, body.base_x, body.base_y, body.base_z)

    new_id = len(_geometries) + 1
    geom = Geometry(id=new_id, type="cylinder", params=body.model_dump(), mesh=mesh)
    _geometries.append(geom)
    return geom


@app.post("/geometry/boolean", tags=["geometry"], response_model=Geometry)
async def create_boolean(body: BooleanRequest):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    left = _get_geometry(body.left_id)
    right = _get_geometry(body.right_id)

    allowed = {"box", "sphere", "cylinder"}
    if left.type not in allowed or right.type not in allowed:
        raise HTTPException(status_code=400, detail="Boolean operations currently supported for box, sphere, and cylinder only")

    try:
        mesh = _build_boolean_mesh(body.operation, left, right)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    new_id = len(_geometries) + 1
    params = {"operation": body.operation, "left": left.id, "right": right.id}
    geom = Geometry(id=new_id, type="boolean", params=params, mesh=mesh)
    _geometries.append(geom)
    return geom


def _gmsh_available():
    return gmsh is not None


def _get_geometry(geom_id: int) -> Geometry:
    for geom in _geometries:
        if geom.id == geom_id:
            return geom
    raise HTTPException(status_code=404, detail=f"Geometry {geom_id} not found")


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
        return _extract_surface_mesh()
    finally:
        gmsh.finalize()


@app.post("/geometry/upload", tags=["geometry"], response_model=Geometry)
async def upload_cad(file: UploadFile = File(...)):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    filename = file.filename or "cad_file"
    ext = Path(filename).suffix.lower().lstrip(".")
    allowed = {"step", "stp", "iges", "igs", "brep", "stl", "vtk", "msh"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported format. Use STEP, IGES, BREP, STL, VTK, or MSH.")

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp.write(content)
            tmp_path = Path(tmp.name)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
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
        tmp_path.unlink(missing_ok=True)

    new_id = len(_geometries) + 1
    geom = Geometry(id=new_id, type="cad", params={"filename": filename, "ext": ext}, mesh=mesh)
    _geometries.append(geom)
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

        node_ids, node_coords, _ = gmsh.model.mesh.getNodes()
        nodes = [
            MeshNode(
                id=int(node_ids[i]),
                x=float(node_coords[3 * i]),
                y=float(node_coords[3 * i + 1]),
                z=float(node_coords[3 * i + 2]),
            )
            for i in range(len(node_ids))
        ]

        elem_types, _, elem_node_tags = gmsh.model.mesh.getElements(dim=2)
        triangles: list[list[int]] = []
        for idx, etype in enumerate(elem_types):
            if etype != 2:  # type 2 = triangle elements
                continue
            node_tags = elem_node_tags[idx]
            for i in range(0, len(node_tags), 3):
                triangles.append([
                    int(node_tags[i]),
                    int(node_tags[i + 1]),
                    int(node_tags[i + 2]),
                ])

        return Mesh(nodes=nodes, triangles=triangles)
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

        return _extract_surface_mesh()
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

        return _extract_surface_mesh()
    finally:
        gmsh.finalize()


def _extract_surface_mesh() -> Mesh:
    node_ids, node_coords, _ = gmsh.model.mesh.getNodes()
    nodes = [
        MeshNode(
            id=int(node_ids[i]),
            x=float(node_coords[3 * i]),
            y=float(node_coords[3 * i + 1]),
            z=float(node_coords[3 * i + 2]),
        )
        for i in range(len(node_ids))
    ]

    # Prefer surface elements; if missing, derive boundary from volume elements.
    elem_types, _, elem_node_tags = gmsh.model.mesh.getElements(dim=2)
    source = "surface"
    if not elem_types:
        elem_types, _, elem_node_tags = gmsh.model.mesh.getElements()
        source = "volume"

    triangles: list[list[int]] = []
    boundary = set()

    def add_tri(a: int, b: int, c: int):
        key = tuple(sorted((int(a), int(b), int(c))))
        if key in boundary:
            # Internal face (shared by two elements); skip to keep boundary only.
            return
        boundary.add(key)
        triangles.append([int(a), int(b), int(c)])

    for idx, etype in enumerate(elem_types):
        node_tags = elem_node_tags[idx]
        name, dim, order, num_nodes, _, num_primary = gmsh.model.mesh.getElementProperties(etype)
        stride = num_nodes or 0
        primary = num_primary or num_nodes
        if not stride or primary is None:
            continue

        # If this is already a triangle element, just collect them.
        if dim == 2 and primary == 3:
            for i in range(0, len(node_tags), stride):
                a, b, c = node_tags[i:i + 3]
                add_tri(a, b, c)
            continue

        # If this is a quad, split into two tris.
        if dim == 2 and primary == 4:
            for i in range(0, len(node_tags), stride):
                a, b, c, d = node_tags[i:i + primary]
                add_tri(a, b, c)
                add_tri(a, c, d)
            continue

        # For volume elements, use primary corner nodes to build boundary faces.
        if dim == 3:
            for i in range(0, len(node_tags), stride):
                corners = list(node_tags[i:i + primary])
                if len(corners) < primary:
                    continue

                if primary == 4:  # tetra (any order)
                    a, b, c, d = corners[:4]
                    add_tri(a, b, c)
                    add_tri(a, b, d)
                    add_tri(a, c, d)
                    add_tri(b, c, d)
                    continue

                if primary == 5:  # pyramid
                    a, b, c, d, e = corners[:5]
                    add_tri(a, b, c)
                    add_tri(a, c, d)
                    add_tri(a, b, e)
                    add_tri(b, c, e)
                    add_tri(c, d, e)
                    add_tri(d, a, e)
                    continue

                if primary == 6:  # prism/wedge
                    a, b, c, d, e, f = corners[:6]
                    add_tri(a, b, c)
                    add_tri(d, f, e)
                    quads = [(a, b, f, d), (b, c, e, f), (c, a, d, e)]
                    for q in quads:
                        q1, q2, q3, q4 = q
                        add_tri(q1, q2, q3)
                        add_tri(q1, q3, q4)
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
                        add_tri(x, y, z)
                        add_tri(x, z, w)
                    continue

                # Fallback: take first three nodes of the element chunk.
                if primary >= 3:
                    add_tri(corners[0], corners[1], corners[2])

    # If we got nothing (e.g., degenerate input), return empty triangles to avoid crashes.
    return Mesh(nodes=nodes, triangles=triangles)


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
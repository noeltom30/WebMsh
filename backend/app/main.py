import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

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


def _gmsh_available():
    return gmsh is not None


@app.post("/geometry/upload", tags=["geometry"], response_model=Geometry)
async def upload_cad(file: UploadFile = File(...)):
    if not _gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")

    filename = file.filename or "cad_file"
    ext = Path(filename).suffix.lower().lstrip(".")
    allowed = {"step", "stp", "iges", "igs", "brep", "stl"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported CAD format. Use STEP, IGES, BREP, or STL.")

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


def _build_mesh_from_cad(path: Path) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.open(str(path))
        if not gmsh.model.getEntities():
            raise ValueError("CAD file contains no entities")
        gmsh.model.mesh.generate(2)
        return _extract_surface_mesh()
    finally:
        gmsh.finalize()


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
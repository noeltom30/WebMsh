import math
import tempfile
from pathlib import Path
from typing import Any

try:
    import gmsh  # type: ignore
except ImportError:
    gmsh = None

try:
    from .project_models import Mesh, MeshNode, MeshSettings, Point2D
except ImportError:
    from project_models import Mesh, MeshNode, MeshSettings, Point2D


SUPPORTED_UPLOAD_EXTENSIONS = frozenset({"step", "stp", "iges", "igs", "brep", "stl", "vtk", "msh"})
SUPPORTED_EXPORT_FORMATS = frozenset({"msh", "stl", "vtk", "obj"})


def gmsh_available() -> bool:
    return gmsh is not None


def build_box_mesh(
    width: float,
    depth: float,
    height: float,
    origin_x: float,
    origin_y: float,
    origin_z: float,
    mesh_settings: MeshSettings | None = None,
) -> Mesh:
    return _run_model(
        "box",
        lambda: gmsh.model.occ.addBox(origin_x, origin_y, origin_z, width, depth, height),
        mesh_settings,
        dim=2,
    )


def build_sphere_mesh(
    radius: float,
    center_x: float,
    center_y: float,
    center_z: float,
    mesh_settings: MeshSettings | None = None,
) -> Mesh:
    return _run_model(
        "sphere",
        lambda: gmsh.model.occ.addSphere(center_x, center_y, center_z, radius),
        mesh_settings,
        dim=2,
    )


def build_cylinder_mesh(
    radius: float,
    height: float,
    base_x: float,
    base_y: float,
    base_z: float,
    mesh_settings: MeshSettings | None = None,
) -> Mesh:
    return _run_model(
        "cylinder",
        lambda: gmsh.model.occ.addCylinder(base_x, base_y, base_z, 0.0, 0.0, height, radius),
        mesh_settings,
        dim=2,
    )


def build_rectangle_sketch_mesh(
    width: float,
    height: float,
    origin_x: float,
    origin_y: float,
    z: float,
    mesh_settings: MeshSettings | None = None,
) -> Mesh:
    return _run_model(
        "rectangle-sketch",
        lambda: _add_rectangle_surface(width, height, origin_x, origin_y, z),
        mesh_settings,
        dim=2,
    )


def build_circle_sketch_mesh(
    radius: float,
    center_x: float,
    center_y: float,
    z: float,
    mesh_settings: MeshSettings | None = None,
) -> Mesh:
    return _run_model(
        "circle-sketch",
        lambda: gmsh.model.occ.addDisk(center_x, center_y, z, radius, radius),
        mesh_settings,
        dim=2,
    )


def build_polygon_sketch_mesh(
    points: list[Point2D],
    z: float,
    mesh_settings: MeshSettings | None = None,
) -> Mesh:
    return _run_model(
        "polygon-sketch",
        lambda: _add_polygon_surface(points, z),
        mesh_settings,
        dim=2,
    )


def build_extruded_sketch_mesh(
    sketch_type: str,
    params: dict[str, Any],
    height: float,
    mesh_settings: MeshSettings | None = None,
) -> Mesh:
    def add_and_extrude() -> None:
        surface = _add_sketch_surface(sketch_type, params)
        gmsh.model.occ.extrude([(2, surface)], 0.0, 0.0, height)

    return _run_model("extrude", add_and_extrude, mesh_settings, dim=2)


def build_revolved_sketch_mesh(
    sketch_type: str,
    params: dict[str, Any],
    angle_degrees: float,
    mesh_settings: MeshSettings | None = None,
) -> Mesh:
    def add_and_revolve() -> None:
        surface = _add_sketch_surface(sketch_type, params)
        gmsh.model.occ.revolve([(2, surface)], 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, math.radians(angle_degrees))

    return _run_model("revolve", add_and_revolve, mesh_settings, dim=2)


def build_mesh_from_cad(path: Path, mesh_settings: MeshSettings | None = None) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.open(str(path))
        _apply_mesh_settings(mesh_settings)
        entities = gmsh.model.getEntities()
        if not entities and len(gmsh.model.mesh.getNodes()[0]) == 0:
            raise ValueError("CAD/mesh file contains no entities or nodes")

        existing_node_ids, _, _ = gmsh.model.mesh.getNodes()
        surface_elem_types, _, _ = gmsh.model.mesh.getElements(dim=2)
        if len(existing_node_ids) == 0 or not surface_elem_types:
            gmsh.model.mesh.generate(2)
        if mesh_settings and mesh_settings.mesh_order > 1:
            gmsh.model.mesh.setOrder(mesh_settings.mesh_order)
        return _extract_surface_mesh(mesh_settings)
    finally:
        gmsh.finalize()


def export_mesh_to_file(mesh: Mesh, geometry_type: str, labels: list[str], export_format: str) -> tuple[Path, str, str]:
    fmt = export_format.lower()
    if fmt not in SUPPORTED_EXPORT_FORMATS:
        raise ValueError("Unsupported export format")

    suffix = f".{fmt}"
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    path = Path(handle.name)
    handle.close()

    if fmt == "obj":
        _write_obj(path, mesh)
        return path, "model/obj", f"{geometry_type}.obj"
    if fmt == "stl":
        _write_stl(path, mesh, geometry_type)
        return path, "model/stl", f"{geometry_type}.stl"
    if fmt == "vtk":
        _write_vtk(path, mesh)
        return path, "model/vnd.vtk", f"{geometry_type}.vtk"

    _write_msh(path, mesh, labels)
    return path, "model/vnd.gmsh", f"{geometry_type}.msh"


def _run_model(name: str, build_geometry, mesh_settings: MeshSettings | None, *, dim: int) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.model.add(name)
        build_geometry()
        gmsh.model.occ.synchronize()
        _apply_mesh_settings(mesh_settings)
        gmsh.model.mesh.generate(dim)
        if mesh_settings and mesh_settings.mesh_order > 1:
            gmsh.model.mesh.setOrder(mesh_settings.mesh_order)
        return _extract_surface_mesh(mesh_settings)
    finally:
        gmsh.finalize()


def _apply_mesh_settings(mesh_settings: MeshSettings | None) -> None:
    if mesh_settings is None:
        return
    if mesh_settings.mesh_size_min is not None:
        gmsh.option.setNumber("Mesh.MeshSizeMin", mesh_settings.mesh_size_min)
    if mesh_settings.mesh_size_max is not None:
        gmsh.option.setNumber("Mesh.MeshSizeMax", mesh_settings.mesh_size_max)
    if mesh_settings.algorithm is not None:
        gmsh.option.setNumber("Mesh.Algorithm", mesh_settings.algorithm)


def _add_rectangle_surface(width: float, height: float, origin_x: float, origin_y: float, z: float) -> int:
    p1 = gmsh.model.occ.addPoint(origin_x, origin_y, z)
    p2 = gmsh.model.occ.addPoint(origin_x + width, origin_y, z)
    p3 = gmsh.model.occ.addPoint(origin_x + width, origin_y + height, z)
    p4 = gmsh.model.occ.addPoint(origin_x, origin_y + height, z)
    lines = [
        gmsh.model.occ.addLine(p1, p2),
        gmsh.model.occ.addLine(p2, p3),
        gmsh.model.occ.addLine(p3, p4),
        gmsh.model.occ.addLine(p4, p1),
    ]
    loop = gmsh.model.occ.addCurveLoop(lines)
    return gmsh.model.occ.addPlaneSurface([loop])


def _add_polygon_surface(points: list[Point2D], z: float) -> int:
    point_tags = [gmsh.model.occ.addPoint(point.x, point.y, z) for point in points]
    lines = [
        gmsh.model.occ.addLine(point_tags[index], point_tags[(index + 1) % len(point_tags)])
        for index in range(len(point_tags))
    ]
    loop = gmsh.model.occ.addCurveLoop(lines)
    return gmsh.model.occ.addPlaneSurface([loop])


def _add_sketch_surface(sketch_type: str, params: dict[str, Any]) -> int:
    if sketch_type == "sketch_rectangle":
        return _add_rectangle_surface(
            float(params["width"]),
            float(params["height"]),
            float(params.get("origin_x", 0)),
            float(params.get("origin_y", 0)),
            float(params.get("z", 0)),
        )
    if sketch_type == "sketch_circle":
        return gmsh.model.occ.addDisk(
            float(params.get("center_x", 0)),
            float(params.get("center_y", 0)),
            float(params.get("z", 0)),
            float(params["radius"]),
            float(params["radius"]),
        )
    if sketch_type == "sketch_polygon":
        points = [Point2D.model_validate(point) for point in params.get("points", [])]
        return _add_polygon_surface(points, float(params.get("z", 0)))
    raise ValueError("Only 2D sketch geometry can be used for this operation")


def _extract_surface_mesh(mesh_settings: MeshSettings | None = None) -> Mesh:
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
    if not elem_types:
        elem_types, _, elem_node_tags = gmsh.model.mesh.getElements()

    triangles: list[list[int]] = []
    boundary_faces: set[tuple[int, int, int]] = set()

    def add_triangle(a: int, b: int, c: int) -> None:
        key = tuple(sorted((int(a), int(b), int(c))))
        if key in boundary_faces:
            return
        boundary_faces.add(key)
        triangles.append([int(a), int(b), int(c)])

    for idx, elem_type in enumerate(elem_types):
        node_tags = elem_node_tags[idx]
        _, dim, _, num_nodes, _, num_primary = gmsh.model.mesh.getElementProperties(elem_type)
        stride = num_nodes or 0
        primary = num_primary or num_nodes
        if not stride or primary is None:
            continue

        if dim == 2 and primary == 3:
            for i in range(0, len(node_tags), stride):
                a, b, c = node_tags[i:i + 3]
                add_triangle(a, b, c)
            continue

        if dim == 2 and primary == 4:
            for i in range(0, len(node_tags), stride):
                a, b, c, d = node_tags[i:i + primary]
                add_triangle(a, b, c)
                add_triangle(a, c, d)
            continue

        if dim != 3:
            continue

        for i in range(0, len(node_tags), stride):
            corners = list(node_tags[i:i + primary])
            if len(corners) < primary:
                continue
            _add_volume_boundary_triangles(corners, primary, add_triangle)

    return Mesh(nodes=nodes, triangles=triangles, mesh_settings=mesh_settings)


def _add_volume_boundary_triangles(corners: list[int], primary: int, add_triangle) -> None:
    if primary == 4:
        a, b, c, d = corners[:4]
        for tri in ((a, b, c), (a, b, d), (a, c, d), (b, c, d)):
            add_triangle(*tri)
        return
    if primary == 5:
        a, b, c, d, e = corners[:5]
        for tri in ((a, b, c), (a, c, d), (a, b, e), (b, c, e), (c, d, e), (d, a, e)):
            add_triangle(*tri)
        return
    if primary == 6:
        a, b, c, d, e, f = corners[:6]
        add_triangle(a, b, c)
        add_triangle(d, f, e)
        for q1, q2, q3, q4 in ((a, b, f, d), (b, c, e, f), (c, a, d, e)):
            add_triangle(q1, q2, q3)
            add_triangle(q1, q3, q4)
        return
    if primary == 8:
        a, b, c, d, e, f, g, h = corners[:8]
        for x, y, z, w in (
            (a, b, c, d),
            (e, f, g, h),
            (a, b, f, e),
            (b, c, g, f),
            (c, d, h, g),
            (d, a, e, h),
        ):
            add_triangle(x, y, z)
            add_triangle(x, z, w)
        return
    if primary >= 3:
        add_triangle(corners[0], corners[1], corners[2])


def _mesh_index(mesh: Mesh) -> dict[int, MeshNode]:
    return {node.id: node for node in mesh.nodes}


def _write_obj(path: Path, mesh: Mesh) -> None:
    id_to_index = {node.id: index + 1 for index, node in enumerate(mesh.nodes)}
    with path.open("w", encoding="utf-8") as handle:
        handle.write("# WebMsh OBJ export\n")
        for node in mesh.nodes:
            handle.write(f"v {node.x} {node.y} {node.z}\n")
        for tri in mesh.triangles:
            if all(node_id in id_to_index for node_id in tri):
                handle.write(f"f {id_to_index[tri[0]]} {id_to_index[tri[1]]} {id_to_index[tri[2]]}\n")


def _write_stl(path: Path, mesh: Mesh, name: str) -> None:
    nodes = _mesh_index(mesh)
    with path.open("w", encoding="utf-8") as handle:
        handle.write(f"solid {name}\n")
        for tri in mesh.triangles:
            if not all(node_id in nodes for node_id in tri):
                continue
            a, b, c = (nodes[node_id] for node_id in tri)
            handle.write("  facet normal 0 0 0\n")
            handle.write("    outer loop\n")
            handle.write(f"      vertex {a.x} {a.y} {a.z}\n")
            handle.write(f"      vertex {b.x} {b.y} {b.z}\n")
            handle.write(f"      vertex {c.x} {c.y} {c.z}\n")
            handle.write("    endloop\n")
            handle.write("  endfacet\n")
        handle.write(f"endsolid {name}\n")


def _write_vtk(path: Path, mesh: Mesh) -> None:
    id_to_index = {node.id: index for index, node in enumerate(mesh.nodes)}
    valid_triangles = [tri for tri in mesh.triangles if all(node_id in id_to_index for node_id in tri)]
    with path.open("w", encoding="utf-8") as handle:
        handle.write("# vtk DataFile Version 3.0\n")
        handle.write("WebMsh export\n")
        handle.write("ASCII\n")
        handle.write("DATASET POLYDATA\n")
        handle.write(f"POINTS {len(mesh.nodes)} float\n")
        for node in mesh.nodes:
            handle.write(f"{node.x} {node.y} {node.z}\n")
        handle.write(f"POLYGONS {len(valid_triangles)} {len(valid_triangles) * 4}\n")
        for tri in valid_triangles:
            handle.write(f"3 {id_to_index[tri[0]]} {id_to_index[tri[1]]} {id_to_index[tri[2]]}\n")


def _write_msh(path: Path, mesh: Mesh, labels: list[str]) -> None:
    id_to_index = {node.id: index + 1 for index, node in enumerate(mesh.nodes)}
    valid_triangles = [tri for tri in mesh.triangles if all(node_id in id_to_index for node_id in tri)]
    with path.open("w", encoding="utf-8") as handle:
        handle.write("$MeshFormat\n2.2 0 8\n$EndMeshFormat\n")
        if labels:
            handle.write("$PhysicalNames\n")
            handle.write(f"{len(labels)}\n")
            for index, label in enumerate(labels, start=1):
                handle.write(f'2 {index} "{label}"\n')
            handle.write("$EndPhysicalNames\n")
        handle.write("$Nodes\n")
        handle.write(f"{len(mesh.nodes)}\n")
        for index, node in enumerate(mesh.nodes, start=1):
            handle.write(f"{index} {node.x} {node.y} {node.z}\n")
        handle.write("$EndNodes\n")
        handle.write("$Elements\n")
        handle.write(f"{len(valid_triangles)}\n")
        physical = 1 if labels else 0
        for index, tri in enumerate(valid_triangles, start=1):
            tags = f"2 {physical} 0" if labels else "0"
            handle.write(
                f"{index} 2 {tags} {id_to_index[tri[0]]} {id_to_index[tri[1]]} {id_to_index[tri[2]]}\n"
            )
        handle.write("$EndElements\n")

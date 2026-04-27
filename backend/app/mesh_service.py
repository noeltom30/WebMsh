from pathlib import Path

try:
    import gmsh  # type: ignore
except ImportError:
    gmsh = None

try:
    from .project_models import Mesh, MeshNode
except ImportError:
    from project_models import Mesh, MeshNode


SUPPORTED_UPLOAD_EXTENSIONS = frozenset({"step", "stp", "iges", "igs", "brep", "stl", "vtk", "msh"})


def gmsh_available() -> bool:
    return gmsh is not None


def build_box_mesh(
    width: float,
    depth: float,
    height: float,
    origin_x: float,
    origin_y: float,
    origin_z: float,
) -> Mesh:
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
        for idx, elem_type in enumerate(elem_types):
            if elem_type != 2:
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


def build_sphere_mesh(radius: float, center_x: float, center_y: float, center_z: float) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.model.add("sphere")
        gmsh.model.occ.addSphere(center_x, center_y, center_z, radius)
        gmsh.model.occ.synchronize()
        gmsh.model.mesh.generate(2)
        return _extract_surface_mesh()
    finally:
        gmsh.finalize()


def build_cylinder_mesh(radius: float, height: float, base_x: float, base_y: float, base_z: float) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.model.add("cylinder")
        gmsh.model.occ.addCylinder(base_x, base_y, base_z, 0.0, 0.0, height, radius)
        gmsh.model.occ.synchronize()
        gmsh.model.mesh.generate(2)
        return _extract_surface_mesh()
    finally:
        gmsh.finalize()


def build_mesh_from_cad(path: Path) -> Mesh:
    if gmsh is None:
        raise RuntimeError("gmsh is not installed")

    gmsh.initialize([])
    try:
        gmsh.open(str(path))
        entities = gmsh.model.getEntities()
        if not entities and len(gmsh.model.mesh.getNodes()[0]) == 0:
            raise ValueError("CAD/mesh file contains no entities or nodes")

        existing_node_ids, _, _ = gmsh.model.mesh.getNodes()
        surface_elem_types, _, _ = gmsh.model.mesh.getElements(dim=2)
        if len(existing_node_ids) == 0 or not surface_elem_types:
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

            if primary == 4:
                a, b, c, d = corners[:4]
                add_triangle(a, b, c)
                add_triangle(a, b, d)
                add_triangle(a, c, d)
                add_triangle(b, c, d)
                continue

            if primary == 5:
                a, b, c, d, e = corners[:5]
                add_triangle(a, b, c)
                add_triangle(a, c, d)
                add_triangle(a, b, e)
                add_triangle(b, c, e)
                add_triangle(c, d, e)
                add_triangle(d, a, e)
                continue

            if primary == 6:
                a, b, c, d, e, f = corners[:6]
                add_triangle(a, b, c)
                add_triangle(d, f, e)
                for q1, q2, q3, q4 in ((a, b, f, d), (b, c, e, f), (c, a, d, e)):
                    add_triangle(q1, q2, q3)
                    add_triangle(q1, q3, q4)
                continue

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
                continue

            if primary >= 3:
                add_triangle(corners[0], corners[1], corners[2])

    return Mesh(nodes=nodes, triangles=triangles)

import sys
from pathlib import Path
import gmsh


def main():
    if len(sys.argv) < 2:
        print("Usage: python inspect_mesh.py <mesh_file>")
        return 1

    mesh_path = Path(sys.argv[1])
    if not mesh_path.exists():
        print(f"File not found: {mesh_path}")
        return 1

    gmsh.initialize([])
    try:
        gmsh.open(str(mesh_path))
        node_ids, _, _ = gmsh.model.mesh.getNodes()
        print(f"Nodes: {len(node_ids)}")

        surface = gmsh.model.mesh.getElements(dim=2)
        if surface[0]:
            elem_types, _, elem_tags = surface
            print(f"Surface element types: {elem_types}")
            counts = {int(t): len(tags) for t, tags in zip(elem_types, elem_tags)}
            print(f"Surface element counts: {counts}")
        else:
            all_elems = gmsh.model.mesh.getElements()
            elem_types, _, elem_tags = all_elems
            print("No surface elements; all element types:", elem_types)
            counts = {int(t): len(tags) for t, tags in zip(elem_types, elem_tags)}
            print(f"All element counts: {counts}")
    finally:
        gmsh.finalize()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

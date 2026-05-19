# WebMsh Gmsh Feature Expansion Plan

## Summary

Build a demo-focused v1 of the top five Gmsh features:

1. Mesh controls
2. Mesh export
3. Physical group / boundary labels
4. 2D sketches
5. Extrude / revolve tools

The goal is to make WebMsh feel like a real mesh-prep playground without building a full CAD history engine yet. Prefer polished workflows, clear examples, and visible results over exhaustive Gmsh coverage.

## Key Changes

### Backend

- Add a reusable `MeshSettings` model with:
  - `mesh_size_min`
  - `mesh_size_max`
  - `mesh_order`
  - `algorithm`
- Update primitive, upload, sketch, extrude, and revolve mesh generation to accept optional mesh settings.
- Extend `Mesh` response with lightweight metadata:
  - `node_count`
  - `triangle_count`
  - `element_count`
  - `bounding_box`
  - `mesh_settings`
- Add selected-geometry export endpoints:
  - `GET /projects/{project_id}/geometry/{geometry_id}/export?format=msh`
  - supported formats: `msh`, `stl`, `vtk`, `obj`
- Add physical label support using preset labels:
  - `wall`
  - `inlet`
  - `outlet`
  - `support`
  - `load`
  - `symmetry`
- Store labels in geometry `params` for v1 and apply Gmsh physical groups where face/entity mapping is deterministic for generated shapes.
- Add 2D sketch endpoints:
  - rectangle
  - circle
  - polygon
- Add 3D transform endpoints:
  - extrude 2D sketch by height
  - revolve 2D profile around an axis

### Frontend

- Add a “Mesh Settings” panel in the workspace sidebar:
  - coarse/fine preset buttons
  - min/max size inputs
  - order selector
  - algorithm selector
- Add a “Create 2D” section:
  - rectangle
  - circle
  - polygon with editable point rows
- Add an “Operations” section:
  - extrude selected 2D geometry
  - revolve selected 2D geometry/profile
- Add an “Export” control on each geometry list item:
  - download `.msh`
  - download `.stl`
  - download `.vtk`
  - download `.obj`
- Add a “Labels” panel for selected geometry:
  - choose preset label
  - apply to known faces/surfaces where available
  - show labels in the geometry list metadata
- Add simple visual polish for demo value:
  - selected geometry highlight
  - mesh stats display
  - 2D sketches rendered with a distinct color
  - extruded/revolved geometry rendered like current generated meshes

## Implementation Order

1. **Mesh Settings + Metadata**
   - Add backend model.
   - Apply settings to existing box/sphere/cylinder/upload flows.
   - Return mesh stats.
   - Add UI controls and display stats.

2. **Export Selected Geometry**
   - Regenerate/export selected geometry using stored params and mesh settings.
   - Add download API helpers.
   - Add export menu/buttons in geometry list.

3. **2D Sketches**
   - Add backend models and endpoints for rectangle, circle, polygon.
   - Mesh 2D surfaces with Gmsh.
   - Render sketches in Three.js as flat meshes/wires.

4. **Extrude / Revolve**
   - Add backend endpoints that take an existing sketch geometry ID plus operation params.
   - Generate new 3D geometry records.
   - Keep original sketch unchanged.

5. **Preset Physical Labels**
   - Add label data model.
   - Add API to update labels on a geometry.
   - For generated shapes, map presets to known surfaces where practical.
   - Show labels in the UI and include them in `.msh` exports.

## Test Plan

- Backend:
  - Existing box/sphere/cylinder creation still works.
  - Mesh settings change triangle density.
  - Invalid mesh settings return validation errors.
  - Export endpoint returns downloadable files for each supported format.
  - 2D rectangle/circle/polygon generate non-empty meshes.
  - Extrude and revolve generate non-empty 3D meshes.
  - Label updates persist and appear in geometry detail responses.
- Frontend:
  - Workspace still loads existing projects.
  - Mesh settings panel affects newly created geometry.
  - Export buttons download files.
  - 2D sketches render correctly.
  - Extrude/revolve flows create new geometry records.
  - Label UI persists labels after refresh.
- Manual demo scenarios:
  - Create coarse box, then fine sphere, compare mesh stats.
  - Create rectangle sketch, extrude into a plate.
  - Create circle sketch, revolve/extrude into a simple solid.
  - Label a cylinder as inlet/outlet/wall.
  - Export a labeled mesh as `.msh`.

## Assumptions

- Use a **demo-heavy** scope: prioritize clear workflows and useful examples over full CAD robustness.
- Export selected geometry first, not whole-project export.
- Boundary labels use preset labels first, not manual face picking.
- Existing `params` JSON storage is acceptable for v1; no new dedicated geometry tables are required.
- Gmsh remains the source of truth for generated/exported geometry.
- Whole-project booleans, manual face selection, and advanced simulation setup are deferred.

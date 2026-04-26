import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { api } from "./api";
import "./index.css";

function App() {
  const mountRef = useRef(null);
  const geomGroupRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState(null);
  const [info, setInfo] = useState(null);
  const [geoms, setGeoms] = useState([]);
  const [lastAction, setLastAction] = useState("");
  const [boxParams, setBoxParams] = useState({
    width: 1.2,
    height: 1.2,
    depth: 1.2,
    origin_x: "0",
    origin_y: "0",
    origin_z: "0",
  });
  const [sphereParams, setSphereParams] = useState({
    radius: 0.8,
    center_x: "0",
    center_y: "0",
    center_z: "0",
  });
  const [cylParams, setCylParams] = useState({
    radius: 0.6,
    height: 1.5,
    base_x: "0",
    base_y: "0",
    base_z: "0",
  });
  const [cadFile, setCadFile] = useState(null);
  const [booleanOp, setBooleanOp] = useState("fuse");
  const [booleanLeft, setBooleanLeft] = useState("");
  const [booleanRight, setBooleanRight] = useState("");
  const [meshDimension, setMeshDimension] = useState("2");
  const [meshTarget, setMeshTarget] = useState("all");

  const booleanCandidates = geoms.filter((g) =>
    ["box", "sphere", "cylinder"].includes(g.type),
  );
  const remeshCandidates = geoms.filter((g) =>
    ["box", "sphere", "cylinder", "boolean"].includes(g.type),
  );
  const resolvedMeshTarget =
    meshTarget === "all" ||
    remeshCandidates.some((g) => String(g.id) === meshTarget)
      ? meshTarget
      : "all";

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f1117");

    const { clientWidth: width, clientHeight: height } = mount;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(3, 2, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 8, 4);
    scene.add(dir);

    // const grid = new THREE.GridHelper(10, 20, 0x2c3140, 0x1c202b);
    // scene.add(grid);
    const axes = new THREE.AxesHelper(1.25);
    scene.add(axes);

    const geomGroup = new THREE.Group();
    scene.add(geomGroup);
    geomGroupRef.current = geomGroup;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", resize);

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material))
            obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, []);

  useEffect(() => {
    // Load basic API data when UI mounts.
    Promise.all([api.health(), api.info(), api.listGeometry()])
      .then(([h, i, g]) => {
        setHealth(h);
        setInfo(i);
        setGeoms(g);
      })
      .catch(() => {
        setLastAction(
          "API unavailable. Start backend at http://localhost:8000",
        );
      });
  }, []);

  useEffect(() => {
    // Rebuild rendered geometry from latest backend mesh payloads.
    const group = geomGroupRef.current;
    if (!group) return;

    // dispose old meshes
    group.children.forEach((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    group.clear();

    const buildRenderableFromGmsh = (meshData) => {
      if (!meshData?.nodes?.length) return null;

      const positions = new Float32Array(meshData.nodes.length * 3);
      const nodeIndex = new Map();
      meshData.nodes.forEach((n, idx) => {
        // gmsh uses z as vertical; map to y-up in three.js
        positions[3 * idx] = n.x;
        positions[3 * idx + 1] = n.z;
        positions[3 * idx + 2] = n.y;
        nodeIndex.set(n.id, idx);
      });

      const lines = meshData?.lines || [];
      const triangles = meshData?.triangles || [];

      if (lines.length && (!triangles.length || Number(meshData.dimension) === 1)) {
        const linePositions = [];
        lines.forEach((line) => {
          const a = nodeIndex.get(line[0]);
          const b = nodeIndex.get(line[1]);
          if (a === undefined || b === undefined) return;

          linePositions.push(
            positions[3 * a],
            positions[3 * a + 1],
            positions[3 * a + 2],
            positions[3 * b],
            positions[3 * b + 1],
            positions[3 * b + 2],
          );
        });

        if (!linePositions.length) return null;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(linePositions, 3),
        );
        return { kind: "lines", geometry };
      }

      const indices = [];
      triangles.forEach((tri) => {
        const a = nodeIndex.get(tri[0]);
        const b = nodeIndex.get(tri[1]);
        const c = nodeIndex.get(tri[2]);
        if (a === undefined || b === undefined || c === undefined) return;
        indices.push(a, b, c);
      });

      if (!indices.length) return null;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return { kind: "surface", geometry };
    };

    geoms.forEach((g) => {
      const gmshRenderable = buildRenderableFromGmsh(g.mesh);

      if (g.type === "box") {
        const w = Number(g?.params?.width) || 1;
        const h = Number(g?.params?.height) || 1;
        const d = Number(g?.params?.depth) || 1;
        const ox = Number(g?.params?.origin_x) || 0;
        const oy = Number(g?.params?.origin_y) || 0;
        const oz = Number(g?.params?.origin_z) || 0;

        const lineMat = new THREE.LineBasicMaterial({ color: 0x4b8fea });
        if (gmshRenderable?.kind === "lines") {
          group.add(new THREE.LineSegments(gmshRenderable.geometry, lineMat));
          return;
        }

        if (gmshRenderable?.kind === "surface") {
          const wireframe = new THREE.WireframeGeometry(gmshRenderable.geometry);
          group.add(new THREE.LineSegments(wireframe, lineMat));
          return;
        }

        const geo = new THREE.BoxGeometry(w, h, d);
        const edges = new THREE.EdgesGeometry(geo);
        const wire = new THREE.LineSegments(edges, lineMat);
        wire.position.set(ox + w / 2, oz + h / 2, oy + d / 2);
        group.add(wire);
        return;
      }

      if (g.type === "sphere") {
        const r = Number(g?.params?.radius) || 1;
        const cx = Number(g?.params?.center_x) || 0;
        const cy = Number(g?.params?.center_y) || 0;
        const cz = Number(g?.params?.center_z) || 0;

        const lineMat = new THREE.LineBasicMaterial({ color: 0xf5c542 });
        if (gmshRenderable?.kind === "lines") {
          group.add(new THREE.LineSegments(gmshRenderable.geometry, lineMat));
          return;
        }

        if (gmshRenderable?.kind === "surface") {
          const wireframe = new THREE.WireframeGeometry(gmshRenderable.geometry);
          group.add(new THREE.LineSegments(wireframe, lineMat));
          return;
        }

        const geo = new THREE.SphereGeometry(r, 24, 16);
        const edges = new THREE.EdgesGeometry(geo);
        const wire = new THREE.LineSegments(edges, lineMat);
        wire.position.set(cx, cz, cy);
        group.add(wire);
        return;
      }

      if (g.type === "cylinder") {
        const r = Number(g?.params?.radius) || 1;
        const h = Number(g?.params?.height) || 1;
        const bx = Number(g?.params?.base_x) || 0;
        const by = Number(g?.params?.base_y) || 0;
        const bz = Number(g?.params?.base_z) || 0;

        const lineMat = new THREE.LineBasicMaterial({ color: 0x5ad35a });
        if (gmshRenderable?.kind === "lines") {
          group.add(new THREE.LineSegments(gmshRenderable.geometry, lineMat));
          return;
        }

        if (gmshRenderable?.kind === "surface") {
          const wireframe = new THREE.WireframeGeometry(gmshRenderable.geometry);
          group.add(new THREE.LineSegments(wireframe, lineMat));
          return;
        }

        const geo = new THREE.CylinderGeometry(r, r, h, 24, 1);
        const edges = new THREE.EdgesGeometry(geo);
        const wire = new THREE.LineSegments(edges, lineMat);
        wire.position.set(bx, bz + h / 2, by);
        group.add(wire);
        return;
      }

      if (g.type === "cad") {
        if (!gmshRenderable) return;
        if (gmshRenderable.kind === "lines") {
          const line = new THREE.LineSegments(
            gmshRenderable.geometry,
            new THREE.LineBasicMaterial({ color: 0x7ad4ff }),
          );
          group.add(line);
          return;
        }
        const mat = new THREE.MeshStandardMaterial({
          color: 0x7ad4ff,
          wireframe: true,
          transparent: true,
          opacity: 0.7,
        });
        const mesh = new THREE.Mesh(gmshRenderable.geometry, mat);
        group.add(mesh);
        return;
      }

      if (g.type === "boolean") {
        if (!gmshRenderable) return;
        if (gmshRenderable.kind === "lines") {
          const line = new THREE.LineSegments(
            gmshRenderable.geometry,
            new THREE.LineBasicMaterial({ color: 0xf08bd2 }),
          );
          group.add(line);
          return;
        }
        const mat = new THREE.MeshStandardMaterial({
          color: 0xf08bd2,
          wireframe: true,
          transparent: true,
          opacity: 0.7,
        });
        const mesh = new THREE.Mesh(gmshRenderable.geometry, mat);
        group.add(mesh);
      }
    });
  }, [geoms]);

  const handleBox = async () => {
    try {
      const geom = await api.createBox({
        width: Number(boxParams.width),
        height: Number(boxParams.height),
        depth: Number(boxParams.depth),
        origin_x: parseFloat(boxParams.origin_x) || 0,
        origin_y: parseFloat(boxParams.origin_y) || 0,
        origin_z: parseFloat(boxParams.origin_z) || 0,
      });
      const list = await api.listGeometry();
      setGeoms(list);
      setLastAction(`Created box id ${geom.id}`);
    } catch (err) {
      setLastAction(err.body?.detail || "Failed to create box");
    }
  };

  const handleSphere = async () => {
    try {
      const geom = await api.createSphere({
        radius: Number(sphereParams.radius),
        center_x: parseFloat(sphereParams.center_x) || 0,
        center_y: parseFloat(sphereParams.center_y) || 0,
        center_z: parseFloat(sphereParams.center_z) || 0,
      });
      const list = await api.listGeometry();
      setGeoms(list);
      setLastAction(`Created sphere id ${geom.id}`);
    } catch (err) {
      setLastAction(err.body?.detail || "Failed to create sphere");
    }
  };

  const handleCylinder = async () => {
    try {
      const geom = await api.createCylinder({
        radius: Number(cylParams.radius),
        height: Number(cylParams.height),
        base_x: parseFloat(cylParams.base_x) || 0,
        base_y: parseFloat(cylParams.base_y) || 0,
        base_z: parseFloat(cylParams.base_z) || 0,
      });
      const list = await api.listGeometry();
      setGeoms(list);
      setLastAction(`Created cylinder id ${geom.id}`);
    } catch (err) {
      setLastAction(err.body?.detail || "Failed to create cylinder");
    }
  };

  const handleCadUpload = async () => {
    if (!cadFile) {
      setLastAction("Choose a STEP/IGES/BREP/STL/VTK/MSH file first");
      return;
    }
    try {
      const geom = await api.uploadCAD(cadFile);
      const list = await api.listGeometry();
      setGeoms(list);
      setLastAction(`Uploaded CAD id ${geom.id}`);
    } catch (err) {
      setLastAction(err.body?.detail || "Failed to upload CAD");
    }
  };

  const handleDeleteGeom = async (id) => {
    try {
      await api.deleteGeometry(id);
      const list = await api.listGeometry();
      setGeoms(list);
      setLastAction(`Deleted geometry ${id}`);
    } catch (err) {
      setLastAction(err.body?.detail || "Failed to delete geometry");
    }
  };

  const handleBoolean = async () => {
    if (!booleanLeft || !booleanRight) {
      setLastAction("Choose two geometries to combine");
      return;
    }
    if (booleanLeft === booleanRight) {
      setLastAction("Pick two different geometries");
      return;
    }

    try {
      const geom = await api.createBoolean({
        operation: booleanOp,
        left_id: Number(booleanLeft),
        right_id: Number(booleanRight),
      });
      const list = await api.listGeometry();
      setGeoms(list);
      setLastAction(`${booleanOp} result id ${geom.id}`);
    } catch (err) {
      setLastAction(err.body?.detail || "Failed to run boolean operation");
    }
  };

  const handleGenerateMesh = async () => {
    if (!remeshCandidates.length) {
      setLastAction("Create a primitive or boolean geometry before generating a mesh");
      return;
    }

    try {
      const body = {
        dimension: Number(meshDimension),
        ...(resolvedMeshTarget !== "all"
          ? { geometry_ids: [Number(resolvedMeshTarget)] }
          : {}),
      };
      const response = await api.generateMesh(body);
      setGeoms(response.geometries);
      const scope =
        resolvedMeshTarget === "all"
          ? "geometries"
          : `geometry ${resolvedMeshTarget}`;
      setLastAction(
        `Generated ${response.dimension}D mesh for ${response.updated_ids.length} ${scope}`,
      );
    } catch (err) {
      setLastAction(err.body?.detail || "Failed to generate mesh");
    }
  };

  const refreshInfo = async () => {
    const [h, i, g] = await Promise.all([
      api.health(),
      api.info(),
      api.listGeometry(),
    ]);
    setHealth(h);
    setInfo(i);
    setGeoms(g);
    setLastAction("Refreshed status");
  };

  return (
    <div className="layout">
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">WebMsh</span>
          <button
            className="collapse-btn"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        {!collapsed && (
          <div className="sidebar-body">
            <div className="sidebar-section">Geometry</div>
            <ul className="sidebar-list">
              <li className="list-row">
                <span>Box</span>
                <div className="field-row">
                  <label>Size X</label>
                  <input
                    type="number"
                    step="0.1"
                    value={boxParams.width}
                    onChange={(e) =>
                      setBoxParams((p) => ({
                        ...p,
                        width: parseFloat(e.target.value),
                      }))
                    }
                  />
                  <label>Size Y</label>
                  <input
                    type="number"
                    step="0.1"
                    value={boxParams.height}
                    onChange={(e) =>
                      setBoxParams((p) => ({
                        ...p,
                        height: parseFloat(e.target.value),
                      }))
                    }
                  />
                  <label>Size Z</label>
                  <input
                    type="number"
                    step="0.1"
                    value={boxParams.depth}
                    onChange={(e) =>
                      setBoxParams((p) => ({
                        ...p,
                        depth: parseFloat(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="field-row">
                  <label>Pos X</label>
                  <input
                    type="number"
                    step="0.1"
                    value={boxParams.origin_x}
                    onChange={(e) =>
                      setBoxParams((p) => ({ ...p, origin_x: e.target.value }))
                    }
                  />
                  <label>Pos Y</label>
                  <input
                    type="number"
                    step="0.1"
                    value={boxParams.origin_y}
                    onChange={(e) =>
                      setBoxParams((p) => ({ ...p, origin_y: e.target.value }))
                    }
                  />
                  <label>Pos Z</label>
                  <input
                    type="number"
                    step="0.1"
                    value={boxParams.origin_z}
                    onChange={(e) =>
                      setBoxParams((p) => ({ ...p, origin_z: e.target.value }))
                    }
                  />
                </div>
                <button className="btn" onClick={handleBox}>
                  Create
                </button>
              </li>
              <li className="list-row">
                <span>Sphere</span>
                <div className="field-row">
                  <label>Radius</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sphereParams.radius}
                    onChange={(e) =>
                      setSphereParams((p) => ({
                        ...p,
                        radius: parseFloat(e.target.value),
                      }))
                    }
                  />
                  <label>Pos X</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sphereParams.center_x}
                    onChange={(e) =>
                      setSphereParams((p) => ({
                        ...p,
                        center_x: e.target.value,
                      }))
                    }
                  />
                  <label>Pos Y</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sphereParams.center_y}
                    onChange={(e) =>
                      setSphereParams((p) => ({
                        ...p,
                        center_y: e.target.value,
                      }))
                    }
                  />
                  <label>Pos Z</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sphereParams.center_z}
                    onChange={(e) =>
                      setSphereParams((p) => ({
                        ...p,
                        center_z: e.target.value,
                      }))
                    }
                  />
                </div>
                <button className="btn" onClick={handleSphere}>
                  Create
                </button>
              </li>
              <li className="list-row">
                <span>Cylinder</span>
                <div className="field-row">
                  <label>Radius</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cylParams.radius}
                    onChange={(e) =>
                      setCylParams((p) => ({
                        ...p,
                        radius: parseFloat(e.target.value),
                      }))
                    }
                  />
                  <label>Height</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cylParams.height}
                    onChange={(e) =>
                      setCylParams((p) => ({
                        ...p,
                        height: parseFloat(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="field-row">
                  <label>Pos X</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cylParams.base_x}
                    onChange={(e) =>
                      setCylParams((p) => ({ ...p, base_x: e.target.value }))
                    }
                  />
                  <label>Pos Y</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cylParams.base_y}
                    onChange={(e) =>
                      setCylParams((p) => ({ ...p, base_y: e.target.value }))
                    }
                  />
                  <label>Pos Z</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cylParams.base_z}
                    onChange={(e) =>
                      setCylParams((p) => ({ ...p, base_z: e.target.value }))
                    }
                  />
                </div>
                <button className="btn" onClick={handleCylinder}>
                  Create
                </button>
              </li>
              <li className="list-row">
                <span>Import CAD / Mesh</span>
                <div className="field-row file-row">
                  <input
                    type="file"
                    accept=".step,.stp,.iges,.igs,.brep,.stl,.vtk,.msh"
                    onChange={(e) => setCadFile(e.target.files?.[0] || null)}
                  />
                  <span className="file-name">
                    {cadFile ? cadFile.name : "No file chosen"}
                  </span>
                </div>
                <button className="btn" onClick={handleCadUpload}>
                  Upload & Mesh
                </button>
              </li>
            </ul>

            <div className="sidebar-section">Operations</div>
            <div className="card">
              <div className="field-row">
                <label>Operation</label>
                <select
                  value={booleanOp}
                  onChange={(e) => setBooleanOp(e.target.value)}
                >
                  <option value="fuse">Fuse (union)</option>
                  <option value="cut">Cut (A - B)</option>
                  <option value="intersect">Intersect</option>
                </select>
              </div>
              <div className="field-row">
                <label>Target (A)</label>
                <select
                  value={booleanLeft}
                  onChange={(e) => setBooleanLeft(e.target.value)}
                >
                  <option value="">Select geometry</option>
                  {booleanCandidates.map((g) => (
                    <option key={g.id} value={g.id}>{`${g.type} #${g.id}`}</option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <label>Tool (B)</label>
                <select
                  value={booleanRight}
                  onChange={(e) => setBooleanRight(e.target.value)}
                >
                  <option value="">Select geometry</option>
                  {booleanCandidates.map((g) => (
                    <option key={g.id} value={g.id}>{`${g.type} #${g.id}`}</option>
                  ))}
                </select>
              </div>
              <button className="btn" onClick={handleBoolean} disabled={booleanCandidates.length < 2}>
                Run Boolean
              </button>
              <div className="note" style={{ marginTop: "8px" }}>
                Works with boxes, spheres, and cylinders. A cut uses A minus B.
              </div>
            </div>

            <div className="sidebar-section">Mesh</div>
            <div className="card">
              <div className="field-row">
                <label>Dimension</label>
                <select
                  value={meshDimension}
                  onChange={(e) => setMeshDimension(e.target.value)}
                >
                  <option value="1">1D (curves)</option>
                  <option value="2">2D (surfaces)</option>
                  <option value="3">3D (volumes)</option>
                </select>
              </div>
              <div className="field-row">
                <label>Target</label>
                <select
                  value={resolvedMeshTarget}
                  onChange={(e) => setMeshTarget(e.target.value)}
                >
                  <option value="all">All supported geometries</option>
                  {remeshCandidates.map((g) => (
                    <option key={g.id} value={g.id}>{`${g.type} #${g.id}`}</option>
                  ))}
                </select>
              </div>
              <button className="btn" onClick={handleGenerateMesh}>
                Generate Mesh
              </button>
              <div className="note" style={{ marginTop: "8px" }}>
                Remeshing currently supports boxes, spheres, cylinders, and boolean results.
              </div>
            </div>

            <div className="sidebar-section">Status</div>
            <div className="card">
              <div className="status-row">
                <span>Health:</span>
                <span>{health ? health.status : "—"}</span>
              </div>
              <div className="status-row">
                <span>Backend:</span>
                <span>{info ? `${info.name} v${info.version}` : "—"}</span>
              </div>
              <div className="status-row">
                <span>gmsh:</span>
                <span>
                  {info ? (info.gmsh_available ? "available" : "missing") : "—"}
                </span>
              </div>
              <div className="status-row">
                <span>Geometries:</span>
                <span>{geoms.length}</span>
              </div>
              <button className="btn" onClick={refreshInfo}>
                Refresh
              </button>
            </div>
            {lastAction && <div className="note">{lastAction}</div>}
            {geoms.length > 0 && (
              <div className="card">
                <div className="sidebar-section">Geometry List</div>
                <ul className="sidebar-list compact">
                  {geoms.map((g) => (
                    <div className="geometry-entry" key={g.id}>
                      <li>
                        <span className="geom-title">
                          {g.type} #{g.id}
                        </span>
                        <div className="geom-params">
                          {Object.entries(g.params).map(([key, val]) => (
                            <div className="geom-param-border" key={key}>
                              <span className="geom-param">
                                <span className="geom-param-key">{key}</span>
                                <span className="geom-param-val">{val}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </li>
                      <button
                        className="btn"
                        style={{ marginLeft: "8px", padding: "4px 8px" }}
                        onClick={() => handleDeleteGeom(g.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="viewport" ref={mountRef}>
        <div className="hud">
          <div className="hud-row">
            Orbit: drag • Pan: right-drag • Zoom: scroll
          </div>
          <div className="hud-row">
            Shapes, booleans, and CAD imports render from backend gmsh meshes.
          </div>
        </div>
      </div>

      {collapsed && (
        <button
          className="expand-fab"
          aria-label="Expand sidebar"
          onClick={() => setCollapsed(false)}
        ></button>
      )}
    </div>
  );
}

export default App;

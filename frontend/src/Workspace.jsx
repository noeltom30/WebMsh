import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { api } from './api'
import './index.css'

function Workspace({ user, onUserUpdate, onLogout }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const geomGroupRef = useRef(null)
  const [collapsed, setCollapsed] = useState(false)
  const [health, setHealth] = useState(null)
  const [info, setInfo] = useState(null)
  const [geoms, setGeoms] = useState([])
  const [lastAction, setLastAction] = useState('')
  const [boxParams, setBoxParams] = useState({
    width: 1.2,
    height: 1.2,
    depth: 1.2,
    origin_x: '0',
    origin_y: '0',
    origin_z: '0',
  })
  const [sphereParams, setSphereParams] = useState({ radius: 0.8, center_x: '0', center_y: '0', center_z: '0' })
  const [cylParams, setCylParams] = useState({ radius: 0.6, height: 1.5, base_x: '0', base_y: '0', base_z: '0' })
  const [cadFile, setCadFile] = useState(null)
  const [twoFASetup, setTwoFASetup] = useState(null)
  const [twoFACode, setTwoFACode] = useState('')
  const [twoFABusy, setTwoFABusy] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0f1117')

    const { clientWidth: width, clientHeight: height } = mount
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(3, 2, 4)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(5, 8, 4)
    scene.add(dir)

    const grid = new THREE.GridHelper(10, 20, 0x2c3140, 0x1c202b)
    scene.add(grid)
    const axes = new THREE.AxesHelper(1.25)
    scene.add(axes)

    const geomGroup = new THREE.Group()
    scene.add(geomGroup)
    geomGroupRef.current = geomGroup

    sceneRef.current = scene

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', resize)

    let frameId
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      controls.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else obj.material.dispose()
        }
      })
    }
  }, [])

  useEffect(() => {
    // Load basic API data when UI mounts.
    Promise.all([api.health(), api.info(), api.listGeometry()])
      .then(([h, i, g]) => {
        setHealth(h)
        setInfo(i)
        setGeoms(g)
      })
      .catch((err) => {
        if (err?.status === 401) {
          setLastAction('Session expired. Please sign in again.')
          onLogout?.()
          return
        }
        setLastAction('API unavailable. Start backend at http://localhost:8000')
      })
  }, [onLogout])

  useEffect(() => {
    // Simple sync: rebuild meshes from geometry list (boxes only for now).
    const group = geomGroupRef.current
    if (!group) return

    // dispose old meshes
    group.children.forEach(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
    group.clear()

    const buildMeshFromGmsh = (meshData) => {
      if (!meshData?.nodes?.length || !meshData?.triangles?.length) return null

      const positions = new Float32Array(meshData.nodes.length * 3)
      const nodeIndex = new Map()
      meshData.nodes.forEach((n, idx) => {
        // gmsh uses z as vertical; map to y-up in three.js
        positions[3 * idx] = n.x
        positions[3 * idx + 1] = n.z
        positions[3 * idx + 2] = n.y
        nodeIndex.set(n.id, idx)
      })

      const indices = []
      meshData.triangles.forEach(tri => {
        const a = nodeIndex.get(tri[0])
        const b = nodeIndex.get(tri[1])
        const c = nodeIndex.get(tri[2])
        if (a === undefined || b === undefined || c === undefined) return
        indices.push(a, b, c)
      })

      if (!indices.length) return null

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()
      return geometry
    }

    geoms.forEach(g => {
      const gmshGeo = buildMeshFromGmsh(g.mesh)

      if (g.type === 'box') {
        const w = Number(g?.params?.width) || 1
        const h = Number(g?.params?.height) || 1
        const d = Number(g?.params?.depth) || 1
        const ox = Number(g?.params?.origin_x) || 0
        const oy = Number(g?.params?.origin_y) || 0
        const oz = Number(g?.params?.origin_z) || 0

        const geo = gmshGeo || new THREE.BoxGeometry(w, h, d)
        const edges = new THREE.EdgesGeometry(geo)
        const lineMat = new THREE.LineBasicMaterial({ color: 0x4b8fea })
        const wire = new THREE.LineSegments(edges, lineMat)
        if (!gmshGeo) wire.position.set(ox + w / 2, oz + h / 2, oy + d / 2)
        group.add(wire)
        return
      }

      if (g.type === 'sphere') {
        const r = Number(g?.params?.radius) || 1
        const cx = Number(g?.params?.center_x) || 0
        const cy = Number(g?.params?.center_y) || 0
        const cz = Number(g?.params?.center_z) || 0

        const geo = gmshGeo || new THREE.SphereGeometry(r, 24, 16)
        const edges = new THREE.EdgesGeometry(geo)
        const lineMat = new THREE.LineBasicMaterial({ color: 0xf5c542 })
        const wire = new THREE.LineSegments(edges, lineMat)
        if (!gmshGeo) wire.position.set(cx, cz, cy)
        group.add(wire)
        return
      }

      if (g.type === 'cylinder') {
        const r = Number(g?.params?.radius) || 1
        const h = Number(g?.params?.height) || 1
        const bx = Number(g?.params?.base_x) || 0
        const by = Number(g?.params?.base_y) || 0
        const bz = Number(g?.params?.base_z) || 0

        const geo = gmshGeo || new THREE.CylinderGeometry(r, r, h, 24, 1)
        const edges = new THREE.EdgesGeometry(geo)
        const lineMat = new THREE.LineBasicMaterial({ color: 0x5ad35a })
        const wire = new THREE.LineSegments(edges, lineMat)
        if (!gmshGeo) wire.position.set(bx, bz + h / 2, by)
        group.add(wire)
        return
      }

      if (g.type === 'cad') {
        if (!gmshGeo) return
        const mat = new THREE.MeshStandardMaterial({ color: 0x7ad4ff, wireframe: true, transparent: true, opacity: 0.7 })
        const mesh = new THREE.Mesh(gmshGeo, mat)
        group.add(mesh)
      }
    })
  }, [geoms])

  const handleBox = async () => {
    try {
      const geom = await api.createBox({
        width: Number(boxParams.width),
        height: Number(boxParams.height),
        depth: Number(boxParams.depth),
        origin_x: parseFloat(boxParams.origin_x) || 0,
        origin_y: parseFloat(boxParams.origin_y) || 0,
        origin_z: parseFloat(boxParams.origin_z) || 0,
      })
      const list = await api.listGeometry()
      setGeoms(list)
      setLastAction(`Created box id ${geom.id}`)
    } catch (err) {
      setLastAction(err.body?.detail || 'Failed to create box')
    }
  }

  const handleSphere = async () => {
    try {
      const geom = await api.createSphere({
        radius: Number(sphereParams.radius),
        center_x: parseFloat(sphereParams.center_x) || 0,
        center_y: parseFloat(sphereParams.center_y) || 0,
        center_z: parseFloat(sphereParams.center_z) || 0,
      })
      const list = await api.listGeometry()
      setGeoms(list)
      setLastAction(`Created sphere id ${geom.id}`)
    } catch (err) {
      setLastAction(err.body?.detail || 'Failed to create sphere')
    }
  }

  const handleCylinder = async () => {
    try {
      const geom = await api.createCylinder({
        radius: Number(cylParams.radius),
        height: Number(cylParams.height),
        base_x: parseFloat(cylParams.base_x) || 0,
        base_y: parseFloat(cylParams.base_y) || 0,
        base_z: parseFloat(cylParams.base_z) || 0,
      })
      const list = await api.listGeometry()
      setGeoms(list)
      setLastAction(`Created cylinder id ${geom.id}`)
    } catch (err) {
      setLastAction(err.body?.detail || 'Failed to create cylinder')
    }
  }

  const handleCadUpload = async () => {
    if (!cadFile) {
      setLastAction('Choose a STEP/IGES/BREP/STL file first')
      return
    }
    try {
      const geom = await api.uploadCAD(cadFile)
      const list = await api.listGeometry()
      setGeoms(list)
      setLastAction(`Uploaded CAD id ${geom.id}`)
    } catch (err) {
      setLastAction(err.body?.detail || 'Failed to upload CAD')
    }
  }

  const handleDeleteGeom = async (id) => {
    try {
      await api.deleteGeometry(id)
      const list = await api.listGeometry()
      setGeoms(list)
      setLastAction(`Deleted geometry ${id}`)
    } catch (err) {
      setLastAction(err.body?.detail || 'Failed to delete geometry')
    }
  }

  const refreshInfo = async () => {
    try {
      const [h, i, g] = await Promise.all([api.health(), api.info(), api.listGeometry()])
      setHealth(h)
      setInfo(i)
      setGeoms(g)
      setLastAction('Refreshed status')
    } catch (err) {
      if (err?.status === 401) {
        setLastAction('Session expired. Please sign in again.')
        onLogout?.()
        return
      }
      setLastAction(err.body?.detail || 'Failed to refresh status')
    }
  }

  const start2FASetup = async () => {
    try {
      setTwoFABusy(true)
      const data = await api.start2FASetup()
      setTwoFASetup(data)
      setTwoFACode('')
      setLastAction('2FA setup started. Add the secret in your authenticator app.')
    } catch (err) {
      setLastAction(err.body?.detail || 'Failed to start 2FA setup')
    } finally {
      setTwoFABusy(false)
    }
  }

  const confirm2FASetup = async () => {
    if (!twoFACode.trim()) {
      setLastAction('Enter the 6-digit code from your authenticator app')
      return
    }
    try {
      setTwoFABusy(true)
      const data = await api.confirm2FASetup({ code: twoFACode.trim() })
      if (data?.user) onUserUpdate?.(data.user)
      setTwoFASetup(null)
      setTwoFACode('')
      setLastAction(data?.message || '2FA enabled')
    } catch (err) {
      setLastAction(err.body?.detail || 'Failed to confirm 2FA setup')
    } finally {
      setTwoFABusy(false)
    }
  }

  return (
    <div className="layout">
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-title"></span>
          <button
            className="collapse-btn"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed(v => !v)}
          >
            {collapsed ? '›' : '‹'}
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
                  <input type="number" step="0.1" value={boxParams.width}
                    onChange={e => setBoxParams(p => ({ ...p, width: parseFloat(e.target.value) }))} />
                  <label>Size Y</label>
                  <input type="number" step="0.1" value={boxParams.height}
                    onChange={e => setBoxParams(p => ({ ...p, height: parseFloat(e.target.value) }))} />
                  <label>Size Z</label>
                  <input type="number" step="0.1" value={boxParams.depth}
                    onChange={e => setBoxParams(p => ({ ...p, depth: parseFloat(e.target.value) }))} />
                </div>
                <div className="field-row">
                  <label>Pos X</label>
                  <input type="number" step="0.1" value={boxParams.origin_x}
                    onChange={e => setBoxParams(p => ({ ...p, origin_x: e.target.value }))} />
                  <label>Pos Y</label>
                  <input type="number" step="0.1" value={boxParams.origin_y}
                    onChange={e => setBoxParams(p => ({ ...p, origin_y: e.target.value }))} />
                  <label>Pos Z</label>
                  <input type="number" step="0.1" value={boxParams.origin_z}
                    onChange={e => setBoxParams(p => ({ ...p, origin_z: e.target.value }))} />
                </div>
                <button className="btn" onClick={handleBox}>Create</button>
              </li>
              <li className="list-row">
                <span>Sphere</span>
                <div className="field-row">
                  <label>Radius</label>
                  <input type="number" step="0.1" value={sphereParams.radius}
                    onChange={e => setSphereParams(p => ({ ...p, radius: parseFloat(e.target.value) }))} />
                  <label>Pos X</label>
                  <input type="number" step="0.1" value={sphereParams.center_x}
                    onChange={e => setSphereParams(p => ({ ...p, center_x: e.target.value }))} />
                  <label>Pos Y</label>
                  <input type="number" step="0.1" value={sphereParams.center_y}
                    onChange={e => setSphereParams(p => ({ ...p, center_y: e.target.value }))} />
                  <label>Pos Z</label>
                  <input type="number" step="0.1" value={sphereParams.center_z}
                    onChange={e => setSphereParams(p => ({ ...p, center_z: e.target.value }))} />
                </div>
                <button className="btn" onClick={handleSphere}>Create</button>
              </li>
              <li className="list-row">
                <span>Cylinder</span>
                <div className="field-row">
                  <label>Radius</label>
                  <input type="number" step="0.1" value={cylParams.radius}
                    onChange={e => setCylParams(p => ({ ...p, radius: parseFloat(e.target.value) }))} />
                  <label>Height</label>
                  <input type="number" step="0.1" value={cylParams.height}
                    onChange={e => setCylParams(p => ({ ...p, height: parseFloat(e.target.value) }))} />
                </div>
                <div className="field-row">
                  <label>Pos X</label>
                  <input type="number" step="0.1" value={cylParams.base_x}
                    onChange={e => setCylParams(p => ({ ...p, base_x: e.target.value }))} />
                  <label>Pos Y</label>
                  <input type="number" step="0.1" value={cylParams.base_y}
                    onChange={e => setCylParams(p => ({ ...p, base_y: e.target.value }))} />
                  <label>Pos Z</label>
                  <input type="number" step="0.1" value={cylParams.base_z}
                    onChange={e => setCylParams(p => ({ ...p, base_z: e.target.value }))} />
                </div>
                <button className="btn" onClick={handleCylinder}>Create</button>
              </li>
              <li className="list-row">
                <span>Import CAD / Mesh</span>
                <div className="field-row file-row">
                  <input
                    type="file"
                    accept=".step,.stp,.iges,.igs,.brep,.stl,.vtk,.msh"
                    onChange={e => setCadFile(e.target.files?.[0] || null)}
                  />
                  <span className="file-name">{cadFile ? cadFile.name : 'No file chosen'}</span>
                </div>
                <button className="btn" onClick={handleCadUpload}>Upload & Mesh</button>
              </li>
            </ul>

            <div className="sidebar-section">Operations</div>
            <ul className="sidebar-list">
              <li>Boolean: Fuse / Cut / Intersect</li>
              <li>Transform: Translate / Rotate / Scale</li>
              <li>Import STEP / STL</li>
            </ul>

            <div className="sidebar-section">Mesh</div>
            <ul className="sidebar-list">
              <li>Generate 1D / 2D / 3D</li>
              <li>Algorithms & sizing</li>
              <li>Export .msh / .stl / .vtk</li>
            </ul>

            <div className="sidebar-section">Status</div>
            <div className="card">
              <div className="status-row"><span>User:</span><span>{user?.email || '—'}</span></div>
              <div className="status-row"><span>Health:</span><span>{health ? health.status : '—'}</span></div>
              <div className="status-row"><span>Backend:</span><span>{info ? `${info.name} v${info.version}` : '—'}</span></div>
              <div className="status-row"><span>gmsh:</span><span>{info ? (info.gmsh_available ? 'available' : 'missing') : '—'}</span></div>
              <div className="status-row"><span>Geometries:</span><span>{geoms.length}</span></div>
              <div className="status-row"><span>2FA:</span><span>{user?.totp_enabled ? 'enabled' : 'disabled'}</span></div>
              {!user?.totp_enabled && (
                <button className="btn" onClick={start2FASetup} disabled={twoFABusy}>
                  {twoFABusy ? 'Preparing...' : 'Enable 2FA'}
                </button>
              )}
              <button className="btn" onClick={refreshInfo}>Refresh</button>
              <button className="btn btn-danger" onClick={onLogout}>Sign Out</button>
            </div>
            {twoFASetup && (
              <div className="card">
                <div className="sidebar-section">2FA Setup</div>
                <div className="note">Secret: <code>{twoFASetup.secret}</code></div>
                <div className="note">OTP URI: <code>{twoFASetup.otpauth_uri}</code></div>
                <div className="field-row twofa-row">
                  <label>Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={twoFACode}
                    onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>
                <button className="btn" onClick={confirm2FASetup} disabled={twoFABusy}>
                  {twoFABusy ? 'Verifying...' : 'Confirm 2FA'}
                </button>
              </div>
            )}
            {lastAction && <div className="note">{lastAction}</div>}
            {geoms.length > 0 && (
              <div className="card">
                <div className="sidebar-section">Geometry List</div>
                <ul className="sidebar-list compact">
                  {geoms.map(g => (
                    <li key={g.id}>
                      {g.type} #{g.id} — {JSON.stringify(g.params)}
                      <button
                        className="btn"
                        style={{ marginLeft: '8px', padding: '4px 8px' }}
                        onClick={() => handleDeleteGeom(g.id)}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="viewport" ref={mountRef}>
        <div className="hud">
          <div className="hud-row">Orbit: drag • Pan: right-drag • Zoom: scroll</div>
          <div className="hud-row">3D workspace ready; wiring to commands comes next.</div>
        </div>
      </div>

      {collapsed && (
        <button
          className="expand-fab"
          aria-label="Expand sidebar"
          onClick={() => setCollapsed(false)}
        >
        </button>
      )}
    </div>
  )
}

export default Workspace

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { api } from './api'
import './index.css'

function Workspace({ projectId, user, onLogout }) {
  const navigate = useNavigate()
  const mountRef = useRef(null)
  const geomGroupRef = useRef(null)

  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState(null)
  const [info, setInfo] = useState(null)
  const [project, setProject] = useState(null)
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

  const numericProjectId = Number(projectId)

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))

    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(5, 8, 4)
    scene.add(dir)

    scene.add(new THREE.GridHelper(10, 20, 0x2c3140, 0x1c202b))
    scene.add(new THREE.AxesHelper(1.25))

    const geomGroup = new THREE.Group()
    scene.add(geomGroup)
    geomGroupRef.current = geomGroup

    const resize = () => {
      const { clientWidth: nextWidth, clientHeight: nextHeight } = mount
      camera.aspect = nextWidth / nextHeight
      camera.updateProjectionMatrix()
      renderer.setSize(nextWidth, nextHeight)
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
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((material) => material.dispose())
          else obj.material.dispose()
        }
      })
    }
  }, [])

  useEffect(() => {
    loadWorkspaceData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericProjectId])

  useEffect(() => {
    const group = geomGroupRef.current
    if (!group) return

    group.children.forEach((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
        else child.material.dispose()
      }
    })
    group.clear()

    const buildMeshFromGmsh = (meshData) => {
      if (!meshData?.nodes?.length || !meshData?.triangles?.length) return null

      const positions = new Float32Array(meshData.nodes.length * 3)
      const nodeIndex = new Map()

      meshData.nodes.forEach((node, index) => {
        positions[3 * index] = node.x
        positions[3 * index + 1] = node.z
        positions[3 * index + 2] = node.y
        nodeIndex.set(node.id, index)
      })

      const indices = []
      meshData.triangles.forEach((triangle) => {
        const a = nodeIndex.get(triangle[0])
        const b = nodeIndex.get(triangle[1])
        const c = nodeIndex.get(triangle[2])
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

    geoms.forEach((geometryRecord) => {
      const gmshGeometry = buildMeshFromGmsh(geometryRecord.mesh)

      if (geometryRecord.type === 'box') {
        const w = Number(geometryRecord?.params?.width) || 1
        const h = Number(geometryRecord?.params?.height) || 1
        const d = Number(geometryRecord?.params?.depth) || 1
        const ox = Number(geometryRecord?.params?.origin_x) || 0
        const oy = Number(geometryRecord?.params?.origin_y) || 0
        const oz = Number(geometryRecord?.params?.origin_z) || 0
        const geometry = gmshGeometry || new THREE.BoxGeometry(w, h, d)
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: 0x4b8fea }),
        )
        if (!gmshGeometry) wire.position.set(ox + w / 2, oz + h / 2, oy + d / 2)
        group.add(wire)
        return
      }

      if (geometryRecord.type === 'sphere') {
        const radius = Number(geometryRecord?.params?.radius) || 1
        const cx = Number(geometryRecord?.params?.center_x) || 0
        const cy = Number(geometryRecord?.params?.center_y) || 0
        const cz = Number(geometryRecord?.params?.center_z) || 0
        const geometry = gmshGeometry || new THREE.SphereGeometry(radius, 24, 16)
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: 0xf5c542 }),
        )
        if (!gmshGeometry) wire.position.set(cx, cz, cy)
        group.add(wire)
        return
      }

      if (geometryRecord.type === 'cylinder') {
        const radius = Number(geometryRecord?.params?.radius) || 1
        const height = Number(geometryRecord?.params?.height) || 1
        const bx = Number(geometryRecord?.params?.base_x) || 0
        const by = Number(geometryRecord?.params?.base_y) || 0
        const bz = Number(geometryRecord?.params?.base_z) || 0
        const geometry = gmshGeometry || new THREE.CylinderGeometry(radius, radius, height, 24, 1)
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: 0x5ad35a }),
        )
        if (!gmshGeometry) wire.position.set(bx, bz + height / 2, by)
        group.add(wire)
        return
      }

      if (geometryRecord.type === 'upload' || geometryRecord.type === 'cad') {
        if (!gmshGeometry) return
        const mesh = new THREE.Mesh(
          gmshGeometry,
          new THREE.MeshStandardMaterial({
            color: 0x7ad4ff,
            wireframe: true,
            transparent: true,
            opacity: 0.7,
          }),
        )
        group.add(mesh)
      }
    })
  }, [geoms])

  const loadWorkspaceData = async (message = '') => {
    if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
      setLastAction('Invalid project ID.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const [healthData, infoData, projectData] = await Promise.all([
        api.health(),
        api.info(),
        api.getProject(numericProjectId),
      ])
      setHealth(healthData)
      setInfo(infoData)
      setProject(projectData)
      setGeoms(projectData?.geometries || [])
      if (message) setLastAction(message)
    } catch (requestError) {
      if (requestError?.status === 401) {
        setLastAction('Session expired. Please sign in again.')
        await onLogout?.()
        navigate('/auth', { replace: true })
        return
      }
      if (requestError?.status === 404) {
        setLastAction('Project not found. Return to your profile and open another project.')
        return
      }
      setLastAction(requestError?.body?.detail || 'Workspace data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  const handleBox = async () => {
    try {
      const geometry = await api.createBox(numericProjectId, {
        width: Number(boxParams.width),
        height: Number(boxParams.height),
        depth: Number(boxParams.depth),
        origin_x: parseFloat(boxParams.origin_x) || 0,
        origin_y: parseFloat(boxParams.origin_y) || 0,
        origin_z: parseFloat(boxParams.origin_z) || 0,
      })
      await loadWorkspaceData(`Created box geometry #${geometry.id}`)
    } catch (requestError) {
      setLastAction(requestError?.body?.detail || 'Failed to create box.')
    }
  }

  const handleSphere = async () => {
    try {
      const geometry = await api.createSphere(numericProjectId, {
        radius: Number(sphereParams.radius),
        center_x: parseFloat(sphereParams.center_x) || 0,
        center_y: parseFloat(sphereParams.center_y) || 0,
        center_z: parseFloat(sphereParams.center_z) || 0,
      })
      await loadWorkspaceData(`Created sphere geometry #${geometry.id}`)
    } catch (requestError) {
      setLastAction(requestError?.body?.detail || 'Failed to create sphere.')
    }
  }

  const handleCylinder = async () => {
    try {
      const geometry = await api.createCylinder(numericProjectId, {
        radius: Number(cylParams.radius),
        height: Number(cylParams.height),
        base_x: parseFloat(cylParams.base_x) || 0,
        base_y: parseFloat(cylParams.base_y) || 0,
        base_z: parseFloat(cylParams.base_z) || 0,
      })
      await loadWorkspaceData(`Created cylinder geometry #${geometry.id}`)
    } catch (requestError) {
      setLastAction(requestError?.body?.detail || 'Failed to create cylinder.')
    }
  }

  const handleCadUpload = async () => {
    if (!cadFile) {
      setLastAction('Choose a STEP, IGES, BREP, STL, VTK, or MSH file first.')
      return
    }

    try {
      const geometry = await api.uploadCAD(numericProjectId, cadFile)
      setCadFile(null)
      await loadWorkspaceData(`Uploaded geometry #${geometry.id}`)
    } catch (requestError) {
      setLastAction(requestError?.body?.detail || 'Failed to upload CAD or mesh.')
    }
  }

  const handleDeleteGeom = async (geometryId) => {
    try {
      await api.deleteGeometry(numericProjectId, geometryId)
      await loadWorkspaceData(`Deleted geometry #${geometryId}`)
    } catch (requestError) {
      setLastAction(requestError?.body?.detail || 'Failed to delete geometry.')
    }
  }

  return (
    <div className="layout">
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">{collapsed ? '' : project?.name || 'Workspace'}</span>
          <button
            className="collapse-btn"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? '>' : '<'}
          </button>
        </div>

        {!collapsed && (
          <div className="sidebar-body">
            <div className="sidebar-section">Project</div>
            <div className="card">
              <div className="status-row"><span>Name:</span><span>{project?.name || 'Loading...'}</span></div>
              <div className="status-row"><span>Project ID:</span><span>{projectId}</span></div>
              <div className="status-row"><span>User:</span><span>{user?.email || '--'}</span></div>
              <button className="btn" onClick={() => navigate('/profile')}>Back to Profile</button>
              <button className="btn btn-danger" onClick={onLogout}>Sign Out</button>
            </div>

            <div className="sidebar-section">Geometry</div>
            <ul className="sidebar-list">
              <li className="list-row">
                <span>Box</span>
                <div className="field-row">
                  <label>Size X</label>
                  <input type="number" step="0.1" value={boxParams.width} onChange={(event) => setBoxParams((value) => ({ ...value, width: parseFloat(event.target.value) }))} />
                  <label>Size Y</label>
                  <input type="number" step="0.1" value={boxParams.height} onChange={(event) => setBoxParams((value) => ({ ...value, height: parseFloat(event.target.value) }))} />
                  <label>Size Z</label>
                  <input type="number" step="0.1" value={boxParams.depth} onChange={(event) => setBoxParams((value) => ({ ...value, depth: parseFloat(event.target.value) }))} />
                </div>
                <div className="field-row">
                  <label>Pos X</label>
                  <input type="number" step="0.1" value={boxParams.origin_x} onChange={(event) => setBoxParams((value) => ({ ...value, origin_x: event.target.value }))} />
                  <label>Pos Y</label>
                  <input type="number" step="0.1" value={boxParams.origin_y} onChange={(event) => setBoxParams((value) => ({ ...value, origin_y: event.target.value }))} />
                  <label>Pos Z</label>
                  <input type="number" step="0.1" value={boxParams.origin_z} onChange={(event) => setBoxParams((value) => ({ ...value, origin_z: event.target.value }))} />
                </div>
                <button className="btn" onClick={handleBox}>Create</button>
              </li>

              <li className="list-row">
                <span>Sphere</span>
                <div className="field-row">
                  <label>Radius</label>
                  <input type="number" step="0.1" value={sphereParams.radius} onChange={(event) => setSphereParams((value) => ({ ...value, radius: parseFloat(event.target.value) }))} />
                  <label>Pos X</label>
                  <input type="number" step="0.1" value={sphereParams.center_x} onChange={(event) => setSphereParams((value) => ({ ...value, center_x: event.target.value }))} />
                  <label>Pos Y</label>
                  <input type="number" step="0.1" value={sphereParams.center_y} onChange={(event) => setSphereParams((value) => ({ ...value, center_y: event.target.value }))} />
                  <label>Pos Z</label>
                  <input type="number" step="0.1" value={sphereParams.center_z} onChange={(event) => setSphereParams((value) => ({ ...value, center_z: event.target.value }))} />
                </div>
                <button className="btn" onClick={handleSphere}>Create</button>
              </li>

              <li className="list-row">
                <span>Cylinder</span>
                <div className="field-row">
                  <label>Radius</label>
                  <input type="number" step="0.1" value={cylParams.radius} onChange={(event) => setCylParams((value) => ({ ...value, radius: parseFloat(event.target.value) }))} />
                  <label>Height</label>
                  <input type="number" step="0.1" value={cylParams.height} onChange={(event) => setCylParams((value) => ({ ...value, height: parseFloat(event.target.value) }))} />
                </div>
                <div className="field-row">
                  <label>Pos X</label>
                  <input type="number" step="0.1" value={cylParams.base_x} onChange={(event) => setCylParams((value) => ({ ...value, base_x: event.target.value }))} />
                  <label>Pos Y</label>
                  <input type="number" step="0.1" value={cylParams.base_y} onChange={(event) => setCylParams((value) => ({ ...value, base_y: event.target.value }))} />
                  <label>Pos Z</label>
                  <input type="number" step="0.1" value={cylParams.base_z} onChange={(event) => setCylParams((value) => ({ ...value, base_z: event.target.value }))} />
                </div>
                <button className="btn" onClick={handleCylinder}>Create</button>
              </li>

              <li className="list-row">
                <span>Import CAD / Mesh</span>
                <div className="field-row file-row">
                  <input
                    type="file"
                    accept=".step,.stp,.iges,.igs,.brep,.stl,.vtk,.msh"
                    onChange={(event) => setCadFile(event.target.files?.[0] || null)}
                  />
                  <span className="file-name">{cadFile ? cadFile.name : 'No file chosen'}</span>
                </div>
                <button className="btn" onClick={handleCadUpload}>Upload & Mesh</button>
              </li>
            </ul>

            <div className="sidebar-section">Status</div>
            <div className="card">
              <div className="status-row"><span>Health:</span><span>{health ? health.status : '--'}</span></div>
              <div className="status-row"><span>Backend:</span><span>{info ? `${info.name} v${info.version}` : '--'}</span></div>
              <div className="status-row"><span>gmsh:</span><span>{info ? (info.gmsh_available ? 'available' : 'missing') : '--'}</span></div>
              <div className="status-row"><span>Projects:</span><span>{info?.project_count ?? '--'}</span></div>
              <div className="status-row"><span>Geometries:</span><span>{geoms.length}</span></div>
              <button className="btn" onClick={() => loadWorkspaceData('Workspace refreshed.')}>Refresh</button>
            </div>

            {lastAction && <div className="note">{lastAction}</div>}

            {geoms.length > 0 && (
              <div className="card">
                <div className="sidebar-section">Geometry List</div>
                <ul className="sidebar-list compact">
                  {geoms.map((geometryRecord) => (
                    <li key={geometryRecord.id}>
                      {geometryRecord.type} #{geometryRecord.id} - {JSON.stringify(geometryRecord.params)}
                      <button
                        className="btn"
                        style={{ marginLeft: '8px', padding: '4px 8px' }}
                        onClick={() => handleDeleteGeom(geometryRecord.id)}
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
          <div className="hud-row">Orbit: drag | Pan: right-drag | Zoom: scroll</div>
          <div className="hud-row">{loading ? 'Loading project workspace...' : `Project ready: ${project?.name || `#${projectId}`}`}</div>
        </div>
      </div>

      {collapsed && (
        <button
          className="expand-fab"
          aria-label="Expand sidebar"
          onClick={() => setCollapsed(false)}
        />
      )}
    </div>
  )
}

export default Workspace

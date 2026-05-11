import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { api } from './api'
import Button from './components/ui/Button'

const ChevronLeftIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>)
const ChevronRightIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>)
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>)
const RefreshIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>)

function SideInput({ label, value, onChange, type = "number", step = "0.1" }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={onChange}
        className="h-8 w-full rounded border border-slate-700/80 bg-slate-900/40 px-2 text-xs text-slate-300 shadow-sm transition duration-150 placeholder:text-slate-600 focus:border-indigo-500/60 focus:bg-[#0B0D13] focus:outline-none focus:ring-1 focus:ring-indigo-500/60"
      />
    </div>
  )
}

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
    scene.background = new THREE.Color('#0a0c10')

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
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F] text-slate-300 selection:bg-indigo-500/30 font-sans">
      {/* Sidebar */}
      <aside 
        className={`flex flex-col border-r border-slate-800 bg-[#0B0D13] transition-[width] duration-200 ease-in-out shrink-0 relative ${collapsed ? 'w-[56px]' : 'w-[320px]'}`}
      >
        <div className="flex h-12 items-center justify-between border-b border-slate-800 px-4">
          <span className={`font-medium text-xs tracking-wide text-slate-200 transition-opacity duration-150 whitespace-nowrap ${collapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
            {project?.name || 'Workspace'}
          </span>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-6 w-6 items-center justify-center rounded bg-transparent border-none shadow-none text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors shrink-0 focus:outline-none"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto overflow-x-hidden p-3.5 space-y-5 ${collapsed ? 'hidden' : 'block'}`}>
          
          {/* Project Section */}
          <section className="space-y-2.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Project</h3>
            <div className="rounded border border-slate-800/80 bg-slate-900/20 p-3 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Name</span>
                <span className="font-medium text-slate-300">{project?.name || 'Loading...'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">ID</span>
                <span className="font-medium text-slate-300">{projectId}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">User</span>
                <span className="font-medium text-slate-300 text-right overflow-hidden text-ellipsis whitespace-nowrap pl-2">{user?.email || '--'}</span>
              </div>
              <div className="pt-2 grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate('/profile')}>Profile</Button>
                <Button variant="danger" size="sm" onClick={onLogout}>Sign Out</Button>
              </div>
            </div>
          </section>

          {/* Geometry Section */}
          <section className="space-y-2.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Add Geometry</h3>
            
            <div className="space-y-3">
              {/* Box */}
              <div className="rounded border border-slate-800/80 bg-slate-900/20 p-3 space-y-2.5">
                <h4 className="text-xs font-medium text-slate-300">Box</h4>
                <div className="grid grid-cols-3 gap-1.5">
                  <SideInput label="Size X" value={boxParams.width} onChange={(e) => setBoxParams({...boxParams, width: e.target.value})} />
                  <SideInput label="Size Y" value={boxParams.height} onChange={(e) => setBoxParams({...boxParams, height: e.target.value})} />
                  <SideInput label="Size Z" value={boxParams.depth} onChange={(e) => setBoxParams({...boxParams, depth: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <SideInput label="Pos X" value={boxParams.origin_x} onChange={(e) => setBoxParams({...boxParams, origin_x: e.target.value})} />
                  <SideInput label="Pos Y" value={boxParams.origin_y} onChange={(e) => setBoxParams({...boxParams, origin_y: e.target.value})} />
                  <SideInput label="Pos Z" value={boxParams.origin_z} onChange={(e) => setBoxParams({...boxParams, origin_z: e.target.value})} />
                </div>
                <Button variant="secondary" size="sm" className="w-full mt-1" onClick={handleBox}>Create Box</Button>
              </div>

              {/* Sphere */}
              <div className="rounded border border-slate-800/80 bg-slate-900/20 p-3 space-y-2.5">
                <h4 className="text-xs font-medium text-slate-300">Sphere</h4>
                <div className="grid grid-cols-4 gap-1.5">
                  <SideInput label="Radius" value={sphereParams.radius} onChange={(e) => setSphereParams({...sphereParams, radius: e.target.value})} />
                  <SideInput label="Pos X" value={sphereParams.center_x} onChange={(e) => setSphereParams({...sphereParams, center_x: e.target.value})} />
                  <SideInput label="Pos Y" value={sphereParams.center_y} onChange={(e) => setSphereParams({...sphereParams, center_y: e.target.value})} />
                  <SideInput label="Pos Z" value={sphereParams.center_z} onChange={(e) => setSphereParams({...sphereParams, center_z: e.target.value})} />
                </div>
                <Button variant="secondary" size="sm" className="w-full mt-1" onClick={handleSphere}>Create Sphere</Button>
              </div>

              {/* Cylinder */}
              <div className="rounded border border-slate-800/80 bg-slate-900/20 p-3 space-y-2.5">
                <h4 className="text-xs font-medium text-slate-300">Cylinder</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  <SideInput label="Radius" value={cylParams.radius} onChange={(e) => setCylParams({...cylParams, radius: e.target.value})} />
                  <SideInput label="Height" value={cylParams.height} onChange={(e) => setCylParams({...cylParams, height: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <SideInput label="Pos X" value={cylParams.base_x} onChange={(e) => setCylParams({...cylParams, base_x: e.target.value})} />
                  <SideInput label="Pos Y" value={cylParams.base_y} onChange={(e) => setCylParams({...cylParams, base_y: e.target.value})} />
                  <SideInput label="Pos Z" value={cylParams.base_z} onChange={(e) => setCylParams({...cylParams, base_z: e.target.value})} />
                </div>
                <Button variant="secondary" size="sm" className="w-full mt-1" onClick={handleCylinder}>Create Cylinder</Button>
              </div>

              {/* Upload CAD */}
              <div className="rounded border border-slate-800/80 bg-slate-900/20 p-3 space-y-2.5">
                <h4 className="text-xs font-medium text-slate-300">Import CAD / Mesh</h4>
                <div className="relative flex flex-col items-center justify-center rounded border border-dashed border-slate-700 bg-slate-900/30 px-4 py-4 text-center transition hover:bg-slate-900/50 hover:border-indigo-500/40">
                  <input
                    type="file"
                    accept=".step,.stp,.iges,.igs,.brep,.stl,.vtk,.msh"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(event) => setCadFile(event.target.files?.[0] || null)}
                  />
                  <div className="pointer-events-none">
                    <p className="text-xs text-indigo-400 font-medium truncate max-w-[180px]">{cadFile ? cadFile.name : 'Choose a file'}</p>
                    <p className="text-[10px] text-slate-500 mt-1">STEP, IGES, BREP, STL, VTK, MSH</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="w-full mt-1" onClick={handleCadUpload} disabled={!cadFile}>
                  Upload & Mesh
                </Button>
              </div>
            </div>
          </section>

          {/* Status Section */}
          <section className="space-y-2.5">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</h3>
              <button 
                onClick={() => loadWorkspaceData('Workspace refreshed.')}
                className="bg-transparent border-none shadow-none text-slate-500 hover:text-indigo-400 transition-colors p-1 rounded hover:bg-indigo-500/10 focus:outline-none"
                title="Refresh Workspace"
              >
                <RefreshIcon />
              </button>
            </div>
            <div className="rounded border border-slate-800/80 bg-slate-900/20 p-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Health</span>
                <span className="font-medium text-emerald-500/90">{health ? health.status : '--'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Backend</span>
                <span className="font-medium text-slate-300">{info ? `${info.name} v${info.version}` : '--'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Gmsh</span>
                <span className="font-medium text-slate-300">{info ? (info.gmsh_available ? 'Ready' : 'Missing') : '--'}</span>
              </div>
            </div>
          </section>

          {/* Actions Feedback */}
          {lastAction && (
            <div className="rounded border border-indigo-500/20 bg-indigo-500/10 p-2.5 text-xs text-indigo-200">
              {lastAction}
            </div>
          )}

          {/* Geometry List */}
          {geoms.length > 0 && (
            <section className="space-y-2.5 pb-6">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Geometry List ({geoms.length})</h3>
              <div className="space-y-1.5">
                {geoms.map((g) => (
                  <div key={g.id} className="group flex items-center justify-between rounded border border-slate-800/80 bg-slate-900/20 p-2.5 transition hover:border-indigo-500/30 hover:bg-indigo-500/5">
                    <div className="flex flex-col overflow-hidden mr-2">
                      <span className="text-xs font-medium text-slate-300 capitalize">
                        {g.type} <span className="text-slate-500 ml-1">#{g.id}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 truncate mt-0.5">
                        {Object.entries(g.params || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'No params'}
                      </span>
                    </div>
                    <button
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-transparent border-none shadow-none text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
                      onClick={() => handleDeleteGeom(g.id)}
                      title="Delete geometry"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>

      {/* Viewport */}
      <main className="relative flex-1" ref={mountRef}>
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#090A0F]/80 backdrop-blur-sm transition-opacity duration-300">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500"></div>
              <p className="text-xs font-medium tracking-wider text-indigo-300 uppercase">Loading Workspace</p>
            </div>
          </div>
        )}

        {/* HUD */}
        <div className="absolute bottom-5 left-5 z-10 pointer-events-none">
          <div className="rounded border border-slate-800/60 bg-[#0B0D13]/80 p-3 shadow-xl backdrop-blur-md">
            <div className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-widest text-slate-400">
              <p>Orbit <span className="text-slate-600 lowercase mx-1">drag</span></p>
              <p>Pan <span className="text-slate-600 lowercase mx-1">right-drag</span></p>
              <p>Zoom <span className="text-slate-600 lowercase mx-1">scroll</span></p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-indigo-400 font-medium">
              {!loading && (project?.name || `Project #${projectId}`)}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Workspace

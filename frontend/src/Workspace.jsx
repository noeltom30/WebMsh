import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { api } from './api'
import Button from './components/ui/Button'
import WebMshLogo from './components/layout/WebMshLogo'
import {
  SideInput,
  MeshSettingsPanel,
  SketchPanel,
  OperationsPanel,
  GeometryItem,
} from './components/workspace/WorkspacePanels'

// ── Icons ─────────────────────────────────────────────────────────────────────
const ChevronLeftIcon  = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>)
const ChevronRightIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>)
const RefreshIcon      = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>)
const CubeIcon         = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>)
const GridIcon         = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>)
const TagIcon          = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>)
const DownloadIcon     = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>)

// ── Constants ─────────────────────────────────────────────────────────────────
const SKETCH_TYPES       = new Set(['sketch_rectangle', 'sketch_circle', 'sketch_polygon'])
const DEFAULT_MESH_SETTINGS = { mesh_size_min: null, mesh_size_max: null, mesh_order: 1, algorithm: null }
const EXPORT_FORMATS     = ['msh', 'stl', 'vtk', 'obj']
const PRESET_LABELS      = ['wall', 'inlet', 'outlet', 'support', 'load', 'symmetry']
const SELECTION_COLOR    = 0x93c5fd  // accent blue when geometry is selected

const GEOM_COLORS = {
  box:              0x4b8fea,
  sphere:           0xf5c542,
  cylinder:         0x5ad35a,
  sketch_rectangle: 0x2dd4bf,
  sketch_circle:    0x2dd4bf,
  sketch_polygon:   0x2dd4bf,
  extrude:          0xf97316,
  revolve:          0xf97316,
  upload:           0x7ad4ff,
  cad:              0x7ad4ff,
}

const STAGES = [
  { id: 'geometry', label: 'Geometry', Icon: CubeIcon },
  { id: 'mesh',     label: 'Mesh',     Icon: GridIcon },
  { id: 'label',    label: 'Label',    Icon: TagIcon },
  { id: 'export',   label: 'Export',   Icon: DownloadIcon },
]

const LABEL_DESC = {
  wall:     'No-slip or solid boundary',
  inlet:    'Where fluid or load enters',
  outlet:   'Where fluid exits / pressure BC',
  support:  'Fixed structural constraint',
  load:     'Applied force or pressure surface',
  symmetry: 'Mirror plane — solver assumes reflection',
}

const EXPORT_DESC = {
  msh: 'Gmsh native — for OpenFOAM, FEniCS, Elmer',
  stl: 'Surface mesh — for 3D printing / visualization',
  vtk: 'VTK format — for ParaView',
  obj: 'Wavefront OBJ — general 3D use',
}

// ── Three.js helpers ──────────────────────────────────────────────────────────
function buildMeshFromGmsh(meshData) {
  if (!meshData?.nodes?.length || !meshData?.triangles?.length) return null
  const positions = new Float32Array(meshData.nodes.length * 3)
  const nodeIndex = new Map()
  meshData.nodes.forEach((node, i) => {
    positions[3 * i]     = node.x
    positions[3 * i + 1] = node.z   // axis remap: API y/z → Three.js y/z
    positions[3 * i + 2] = node.y
    nodeIndex.set(node.id, i)
  })
  const indices = []
  meshData.triangles.forEach(([t0, t1, t2]) => {
    const a = nodeIndex.get(t0), b = nodeIndex.get(t1), c = nodeIndex.get(t2)
    if (a !== undefined && b !== undefined && c !== undefined) indices.push(a, b, c)
  })
  if (!indices.length) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function makeWire(geo, color) {
  const mat = new THREE.LineBasicMaterial({ color })
  mat.userData.baseColor = color
  return new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat)
}

function makeFill(geo, color, opacity = 0.18) {
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide })
  mat.userData.baseColor   = color
  mat.userData.baseOpacity = opacity
  return new THREE.Mesh(geo, mat)
}

// ── Product Tour ─────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    targetId:     'ws-tour-controls-hint',
    title:        'The 3D canvas',
    desc:         'Your mesh renders here as a real-time wireframe. Drag to orbit · Scroll to zoom · Right-drag to pan. The grid and axis helpers keep you oriented.',
    placement:    'top',
    expandSidebar: false,
  },
  {
    targetId:     'ws-tour-stage-tabs',
    title:        'The mesh pipeline',
    desc:         'Four stages guide you from shape to solver-ready file — Geometry to add shapes, Mesh to tune density, Label to assign boundary conditions, Export to download.',
    placement:    'bottom',
    expandSidebar: true,
    stageOnEnter: 'geometry',
  },
  {
    targetId:     'ws-primitives',
    title:        'Add geometry',
    desc:         'Create a box, sphere, or cylinder — or import a STEP / IGES / BREP / STL file. Gmsh meshes it on the server and renders the wireframe here instantly.',
    placement:    'right',
    expandSidebar: true,
    stageOnEnter: 'geometry',
    scrollTarget: 'ws-primitives',
  },
  {
    targetId:     'ws-tour-geom-list',
    title:        'Geometry list',
    desc:         'Every geometry you create appears here. Click one to select it — it highlights in blue in the 3D view and its node / triangle stats appear in the top-right HUD.',
    placement:    'right',
    expandSidebar: true,
    stageOnEnter: 'geometry',
  },
  {
    targetId:     'ws-stage-tab-label',
    title:        'Label → Export',
    desc:         'Select a geometry, then open the Label tab to assign boundary conditions (inlet, outlet, wall, symmetry…). Finally use the Export tab to download your .msh, .stl, .vtk, or .obj file for your solver.',
    placement:    'right',
    expandSidebar: true,
    stageOnEnter: 'geometry',
  },
]

function TourTooltip({ step, stepIndex, total, spotlight, onNext, onPrev, onDone, isLast }) {
  const TW = 292
  const PAD = 14
  const vw  = window.innerWidth
  const vh  = window.innerHeight

  const pos = (() => {
    switch (step.placement) {
      case 'right':
        return {
          top:  Math.min(Math.max(spotlight.top, PAD), vh - 220),
          left: Math.min(spotlight.left + spotlight.width + PAD, vw - TW - PAD),
        }
      case 'bottom':
        return {
          top:  Math.min(spotlight.top + spotlight.height + PAD, vh - 220),
          left: Math.max(PAD, Math.min(spotlight.left + spotlight.width / 2 - TW / 2, vw - TW - PAD)),
        }
      case 'top':
        return {
          top:  Math.max(PAD, spotlight.top - 195),
          left: Math.max(PAD, Math.min(spotlight.left + spotlight.width / 2 - TW / 2, vw - TW - PAD)),
        }
      default:
        return { top: vh / 2 - 90, left: Math.max(PAD, Math.min(spotlight.left + 24, vw - TW - PAD)) }
    }
  })()

  return (
    <div
      style={{ position: 'fixed', ...pos, width: TW, zIndex: 9002, animation: 'wsToastIn 0.22s cubic-bezier(0.32,0.72,0,1) both' }}
      className="rounded-xl border border-indigo-500/40 bg-[#0D0F17]/96 p-4 shadow-2xl backdrop-blur-md"
      onClick={e => e.stopPropagation()}>

      {/* Progress pips */}
      <div className="flex gap-1 mb-3">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === stepIndex ? 'w-6 bg-indigo-500' : i < stepIndex ? 'w-2 bg-indigo-800' : 'w-2 bg-slate-700'}`} />
        ))}
      </div>

      <p className="text-[9px] font-semibold uppercase tracking-widest text-indigo-400/70 mb-1">{stepIndex + 1} of {total}</p>
      <h3 className="text-xs font-bold text-slate-100 mb-1.5">{step.title}</h3>
      <p className="text-[11px] text-slate-400 leading-relaxed mb-4">{step.desc}</p>

      <div className="flex items-center justify-between gap-2">
        <button onClick={onDone}
          className="text-[10px] text-slate-700 hover:text-slate-400 transition focus:outline-none">
          Skip tour
        </button>
        <div className="flex gap-1.5">
          {stepIndex > 0 && (
            <button onClick={onPrev}
              className="h-7 px-3 rounded-lg border border-slate-700/80 bg-slate-800/80 text-[10px] font-medium text-slate-400 hover:text-slate-200 hover:border-slate-600 transition focus:outline-none">
              ← Back
            </button>
          )}
          <button onClick={isLast ? onDone : onNext}
            className="h-7 px-4 rounded-lg bg-indigo-600 text-[10px] font-semibold text-white hover:bg-indigo-500 transition focus:outline-none">
            {isLast ? 'Done ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductTour({ onDone, setActiveStage, setCollapsed }) {
  const [step, setStep]  = useState(0)
  const [rect, setRect]  = useState(null)
  const PAD = 10

  const current = TOUR_STEPS[step]
  const isLast  = step === TOUR_STEPS.length - 1

  const advance = useCallback((nextStep) => {
    const s = TOUR_STEPS[nextStep]
    if (s.expandSidebar) setCollapsed(false)
    if (s.stageOnEnter)  setActiveStage(s.stageOnEnter)
    setStep(nextStep)
  }, [setActiveStage, setCollapsed])

  // Measure target element after each step change (and after state/DOM settle)
  useEffect(() => {
    let cancelled = false
    const resolve = () => {
      if (cancelled) return
      // Scroll the sidebar to show the target if needed
      if (current.scrollTarget) {
        document.getElementById(current.scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      // Measure after DOM + scroll settles
      setTimeout(() => {
        if (cancelled) return
        const el = document.getElementById(current.targetId)
        if (el) setRect(el.getBoundingClientRect())
      }, 360)
    }
    // Small delay lets React flush stage/collapsed state changes before we query DOM
    const t = setTimeout(resolve, 60)
    return () => { cancelled = true; clearTimeout(t) }
  }, [step, current])

  // Recompute on resize
  useEffect(() => {
    const onResize = () => {
      const el = document.getElementById(current.targetId)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [current])

  // Dim overlay while rect is resolving
  if (!rect) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8999, background: 'rgba(5,5,10,0.55)' }} onClick={onDone} />
  )

  const spotlight = {
    top:    rect.top    - PAD,
    left:   rect.left   - PAD,
    width:  rect.width  + PAD * 2,
    height: rect.height + PAD * 2,
  }

  return (
    <>
      {/* Click-outside backdrop to skip */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9000 }} onClick={onDone} />

      {/* Spotlight: box-shadow dims everything outside the highlighted area */}
      <div style={{
        position:     'fixed',
        top:          spotlight.top,
        left:         spotlight.left,
        width:        spotlight.width,
        height:       spotlight.height,
        borderRadius: '10px',
        boxShadow:    '0 0 0 9999px rgba(5,5,10,0.78), 0 0 0 2px rgba(99,102,241,0.5), 0 0 28px rgba(99,102,241,0.25)',
        zIndex:       9001,
        pointerEvents:'none',
        transition:   'top 0.38s cubic-bezier(0.32,0.72,0,1), left 0.38s cubic-bezier(0.32,0.72,0,1), width 0.38s cubic-bezier(0.32,0.72,0,1), height 0.38s cubic-bezier(0.32,0.72,0,1)',
      }} />

      {/* Tooltip card */}
      <TourTooltip
        step={current}
        stepIndex={step}
        total={TOUR_STEPS.length}
        spotlight={spotlight}
        isLast={isLast}
        onNext={() => advance(step + 1)}
        onPrev={() => advance(step - 1)}
        onDone={onDone}
      />
    </>
  )
}

// ── Toast notification area ───────────────────────────────────────────────────
function ToastArea({ toasts }) {
  const typeStyles = {
    success: 'border-emerald-500/30 bg-[#0a1a12]/90 text-emerald-200',
    error:   'border-rose-500/30    bg-[#1a0a0a]/90 text-rose-200',
    info:    'border-indigo-500/30  bg-[#0a0d1a]/90 text-indigo-200',
    warning: 'border-amber-500/30   bg-[#1a140a]/90 text-amber-200',
  }
  return (
    <div className="absolute bottom-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          style={{ animation: 'wsToastIn 0.22s cubic-bezier(0.32,0.72,0,1) both' }}
          className={`rounded-lg border px-4 py-2.5 text-xs font-medium shadow-xl backdrop-blur-md max-w-xs ${typeStyles[t.type] || typeStyles.info}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Empty viewport state ──────────────────────────────────────────────────────
function EmptyViewport({ onAction }) {
  const cards = [
    { label: 'Add Primitive', sub: 'Box · Sphere · Cylinder', sectionId: 'ws-primitives' },
    { label: 'Draw a Sketch', sub: '2D profile to extrude',   sectionId: 'ws-sketch' },
    { label: 'Import CAD',    sub: 'STEP · IGES · BREP',      sectionId: 'ws-import' },
  ]
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-5">
        <p className="text-sm text-slate-600 font-medium tracking-wide">Add your first geometry to begin</p>
        <div className="flex gap-3 pointer-events-auto">
          {cards.map(c => (
            <button key={c.sectionId} onClick={() => onAction(c.sectionId)}
              className="group flex flex-col items-center gap-2 rounded-xl border border-slate-800/70 bg-[#0F1117]/90 px-5 py-4 w-36 text-center transition-all duration-200 hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:-translate-y-0.5 focus:outline-none">
              <span className="text-xs font-semibold text-slate-300 group-hover:text-indigo-300 transition-colors">{c.label}</span>
              <span className="text-[10px] text-slate-600 group-hover:text-slate-500 transition-colors">{c.sub}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-700">Or drag a CAD file directly onto the viewport</p>
      </div>
    </div>
  )
}

// ── Label stage panel ─────────────────────────────────────────────────────────
function LabelStagePanel({ selectedGeom, projectId, onRefresh, pushToast }) {
  const [activeLabels, setActiveLabels] = useState(selectedGeom?.params?.labels || [])
  const [busy, setBusy] = useState(false)

  // Keep in sync when selection or server-side labels change
  useEffect(() => {
    setActiveLabels(selectedGeom?.params?.labels || [])
  }, [selectedGeom?.id, JSON.stringify(selectedGeom?.params?.labels)]) // eslint-disable-line

  if (!selectedGeom) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-3">
        <TagIcon />
        <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
          Select a geometry from the list below to assign boundary condition labels.
        </p>
      </div>
    )
  }

  const toggleLabel = async (label) => {
    const next = activeLabels.includes(label)
      ? activeLabels.filter(l => l !== label)
      : [...activeLabels, label]
    const prev = [...activeLabels]
    setActiveLabels(next)
    setBusy(true)
    try {
      await api.updateGeometryLabels(projectId, selectedGeom.id, { labels: next })
      onRefresh()
      pushToast(`Labels updated on geometry #${selectedGeom.id}`, 'success')
    } catch {
      setActiveLabels(prev)
      pushToast('Failed to update labels', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Boundary Labels
        </span>
        {busy && <span className="text-[9px] text-slate-600 animate-pulse">Saving…</span>}
      </div>
      <p className="text-[10px] text-slate-600">
        <span className="text-indigo-400 font-medium">{selectedGeom.type.replace(/_/g, ' ')} #{selectedGeom.id}</span> — hover a label to see its engineering meaning.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESET_LABELS.map(l => (
          <button key={l} onClick={() => toggleLabel(l)} title={LABEL_DESC[l]}
            className={`px-2 py-2 rounded text-[10px] font-semibold uppercase tracking-wider border transition-all ${
              activeLabels.includes(l)
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800/50 border-slate-700/60 text-slate-500 hover:text-slate-300 hover:border-slate-600'
            }`}>
            {l}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-slate-700 leading-relaxed pt-1">
        Labels create Gmsh physical groups in the exported mesh, used by solvers for boundary conditions.
      </p>
    </div>
  )
}

// ── Export stage panel ────────────────────────────────────────────────────────
function ExportStagePanel({ selectedGeom, projectId, pushToast, health, info }) {
  const [busy, setBusy] = useState(false)

  const handleExport = async (fmt) => {
    if (!selectedGeom) return
    setBusy(true)
    try {
      await api.exportGeometry(projectId, selectedGeom.id, fmt)
      pushToast(`Exported as .${fmt} — check your downloads`, 'success')
    } catch (e) {
      pushToast(e?.body?.detail || `Export failed`, 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {/* Export controls */}
      {selectedGeom?.mesh ? (
        <section className="space-y-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Download <span className="text-indigo-400">#{selectedGeom.id}</span>
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {EXPORT_FORMATS.map(fmt => (
              <button key={fmt} disabled={busy} onClick={() => handleExport(fmt)}
                title={EXPORT_DESC[fmt]}
                className="px-2 py-2.5 rounded border border-slate-700/60 bg-slate-800/50 text-[10px] font-bold text-slate-400 hover:bg-indigo-600/20 hover:border-indigo-500/40 hover:text-indigo-300 uppercase tracking-wider transition disabled:opacity-40">
                .{fmt}
              </button>
            ))}
          </div>
          {busy && <p className="text-[10px] text-slate-500 animate-pulse">Preparing download…</p>}
          <p className="text-[10px] text-slate-700 leading-relaxed">Hover a format to see which solvers support it.</p>
        </section>
      ) : selectedGeom ? (
        <div className="flex flex-col items-center justify-center py-8 text-center px-3">
          <p className="text-[11px] text-slate-600">This geometry has no mesh yet. Generate one first from the Mesh tab.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center px-3">
          <DownloadIcon />
          <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
            Select a geometry from the list below to export it.
          </p>
        </div>
      )}

      {/* Status section */}
      <div className="rounded-lg border border-slate-800/70 bg-slate-900/20 p-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">System</p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-600">Health</span>
          <span className={`font-medium font-mono ${health?.status === 'ok' ? 'text-emerald-500' : 'text-rose-400'}`}>
            {health ? health.status : '--'}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-600">Gmsh</span>
          <span className={`font-medium font-mono ${info?.gmsh_available ? 'text-emerald-500' : 'text-amber-400'}`}>
            {info ? (info.gmsh_available ? 'ready' : 'missing') : '--'}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-600">API</span>
          <span className="font-medium font-mono text-slate-500">{info ? `v${info.version}` : '--'}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Workspace component ──────────────────────────────────────────────────
function Workspace({ projectId, user, onLogout }) {
  const navigate    = useNavigate()
  const mountRef       = useRef(null)
  const geomGroupRef   = useRef(null)
  const geomObjectsRef = useRef(new Map())  // geomId → THREE.Group
  const toastIdRef     = useRef(0)
  const sidebarBodyRef = useRef(null)       // scrollable sidebar body

  // UI state
  const [collapsed,      setCollapsed]      = useState(false)
  const [activeStage,    setActiveStage]    = useState('geometry')
  const [loading,        setLoading]        = useState(true)
  const [dragOver,       setDragOver]       = useState(false)
  const [showHint,       setShowHint]       = useState(() => !localStorage.getItem('webmsh_viewport_hint_v1'))
  const [tourActive,     setTourActive]     = useState(false)
  const [showTourPrompt, setShowTourPrompt] = useState(false)

  // Data state
  const [health,         setHealth]         = useState(null)
  const [info,           setInfo]           = useState(null)
  const [project,        setProject]        = useState(null)
  const [geoms,          setGeoms]          = useState([])
  const [toasts,         setToasts]         = useState([])
  const [selectedGeomId, setSelectedGeomId] = useState(null)

  // Form state (unchanged from original)
  const [meshSettings, setMeshSettings] = useState(DEFAULT_MESH_SETTINGS)
  const [boxParams,    setBoxParams]    = useState({ width: 1.2, height: 1.2, depth: 1.2, origin_x: '0', origin_y: '0', origin_z: '0' })
  const [sphereParams, setSphereParams] = useState({ radius: 0.8, center_x: '0', center_y: '0', center_z: '0' })
  const [cylParams,    setCylParams]    = useState({ radius: 0.6, height: 1.5, base_x: '0', base_y: '0', base_z: '0' })
  const [cadFile,      setCadFile]      = useState(null)

  const numericProjectId = Number(projectId)
  const selectedGeom     = geoms.find(g => g.id === selectedGeomId) || null
  const totalNodes       = geoms.reduce((s, g) => s + (g.mesh?.node_count     || 0), 0)
  const totalTris        = geoms.reduce((s, g) => s + (g.mesh?.triangle_count || 0), 0)

  // ── Toast ─────────────────────────────────────────────────────────────────
  const pushToast = useCallback((message, type = 'info') => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  // ── Tour ─────────────────────────────────────────────────────────────────
  const startTour = useCallback(() => {
    setShowTourPrompt(false)
    setTourActive(true)
    localStorage.setItem('webmsh_tour_seen_v1', '1')
  }, [])

  const endTour = useCallback(() => setTourActive(false), [])

  // Auto-prompt new users after workspace loads
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('webmsh_tour_seen_v1')) return
    const t = setTimeout(() => setShowTourPrompt(true), 2800)
    return () => clearTimeout(t)
  }, [loading])

  // ── Build mesh settings payload ───────────────────────────────────────────
  const buildSettings = () => {
    if (!meshSettings.mesh_size_min && !meshSettings.mesh_size_max && !meshSettings.algorithm) return null
    return {
      mesh_size_min: meshSettings.mesh_size_min || null,
      mesh_size_max: meshSettings.mesh_size_max || null,
      mesh_order:    meshSettings.mesh_order    || 1,
      algorithm:     meshSettings.algorithm     || null,
    }
  }

  // ── Three.js scene setup (unchanged logic) ────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene    = new THREE.Scene()
    scene.background = new THREE.Color('#0a0c10')
    const { clientWidth: w, clientHeight: h } = mount
    const camera   = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
    camera.position.set(3, 2, 4)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(w, h)
    mount.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping  = true
    controls.dampingFactor  = 0.08
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
      const { clientWidth: nw, clientHeight: nh } = mount
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener('resize', resize)
    let frameId
    const animate = () => { frameId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera) }
    animate()
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      controls.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else obj.material.dispose()
        }
      })
    }
  }, [])

  // ── Render geometries — per-geom sub-groups for selection targeting ────────
  useEffect(() => {
    const group = geomGroupRef.current
    if (!group) return

    // Full dispose
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      }
    })
    group.clear()
    geomObjectsRef.current.clear()

    geoms.forEach(rec => {
      const gmshGeo  = buildMeshFromGmsh(rec.mesh)
      const p        = rec.params || {}
      const subGroup = new THREE.Group()
      subGroup.userData.geomId = rec.id

      if (rec.type === 'box') {
        const [w, h, d] = [Number(p.width) || 1, Number(p.height) || 1, Number(p.depth) || 1]
        const [ox, oy, oz] = [Number(p.origin_x) || 0, Number(p.origin_y) || 0, Number(p.origin_z) || 0]
        const geo  = gmshGeo || new THREE.BoxGeometry(w, h, d)
        const wire = makeWire(geo, GEOM_COLORS.box)
        if (!gmshGeo) wire.position.set(ox + w / 2, oz + h / 2, oy + d / 2)
        subGroup.add(wire)

      } else if (rec.type === 'sphere') {
        const r   = Number(p.radius) || 1
        const geo = gmshGeo || new THREE.SphereGeometry(r, 24, 16)
        const wire = makeWire(geo, GEOM_COLORS.sphere)
        if (!gmshGeo) wire.position.set(Number(p.center_x) || 0, Number(p.center_z) || 0, Number(p.center_y) || 0)
        subGroup.add(wire)

      } else if (rec.type === 'cylinder') {
        const r = Number(p.radius) || 1, h = Number(p.height) || 1
        const geo  = gmshGeo || new THREE.CylinderGeometry(r, r, h, 24, 1)
        const wire = makeWire(geo, GEOM_COLORS.cylinder)
        if (!gmshGeo) wire.position.set(Number(p.base_x) || 0, (Number(p.base_z) || 0) + h / 2, Number(p.base_y) || 0)
        subGroup.add(wire)

      } else if (SKETCH_TYPES.has(rec.type)) {
        if (gmshGeo) {
          subGroup.add(makeWire(gmshGeo, GEOM_COLORS.sketch_rectangle))
          subGroup.add(makeFill(gmshGeo, GEOM_COLORS.sketch_rectangle, 0.18))
        }

      } else if (['extrude', 'revolve', 'upload', 'cad'].includes(rec.type)) {
        if (gmshGeo) {
          const color = (rec.type === 'upload' || rec.type === 'cad') ? GEOM_COLORS.upload : GEOM_COLORS.extrude
          subGroup.add(makeWire(gmshGeo, color))
        }
      }

      group.add(subGroup)
      geomObjectsRef.current.set(rec.id, subGroup)
    })
  }, [geoms])

  // ── Selection highlight — runs after geoms render (defined after render effect)
  useEffect(() => {
    geomObjectsRef.current.forEach((subGroup, geomId) => {
      const isSelected = geomId === selectedGeomId
      subGroup.traverse(obj => {
        if (!obj.material) return
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(mat => {
          if (mat.color && mat.userData.baseColor !== undefined) {
            mat.color.setHex(isSelected ? SELECTION_COLOR : mat.userData.baseColor)
          }
          if (mat.transparent && mat.userData.baseOpacity !== undefined) {
            mat.opacity = isSelected
              ? Math.min(mat.userData.baseOpacity + 0.14, 0.45)
              : mat.userData.baseOpacity
          }
        })
      })
    })
  }, [selectedGeomId, geoms]) // include geoms: re-apply after scene rebuild

  // ── Load workspace data ───────────────────────────────────────────────────
  useEffect(() => { loadWorkspaceData() }, [numericProjectId]) // eslint-disable-line

  const loadWorkspaceData = async (message = '') => {
    if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
      pushToast('Invalid project ID.', 'error')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [healthData, infoData, projectData] = await Promise.all([
        api.health(), api.info(), api.getProject(numericProjectId),
      ])
      setHealth(healthData)
      setInfo(infoData)
      setProject(projectData)
      setGeoms(projectData?.geometries || [])
      if (message) pushToast(message, 'success')
    } catch (err) {
      if (err?.status === 401) {
        pushToast('Session expired. Signing out…', 'error')
        await onLogout?.()
        navigate('/auth', { replace: true })
        return
      }
      if (err?.status === 404) { pushToast('Project not found.', 'error'); return }
      pushToast(err?.body?.detail || 'Workspace could not be loaded.', 'error')
    } finally { setLoading(false) }
  }

  // ── Geometry handlers (all logic identical to original) ───────────────────
  const handleBox = async () => {
    try {
      const g = await api.createBox(numericProjectId, {
        width:    Number(boxParams.width),
        height:   Number(boxParams.height),
        depth:    Number(boxParams.depth),
        origin_x: parseFloat(boxParams.origin_x) || 0,
        origin_y: parseFloat(boxParams.origin_y) || 0,
        origin_z: parseFloat(boxParams.origin_z) || 0,
        mesh_settings: buildSettings(),
      })
      await loadWorkspaceData(`Box meshed · ${(g.mesh?.node_count || 0).toLocaleString()} nodes`)
    } catch (e) { pushToast(e?.body?.detail || 'Failed to create box.', 'error') }
  }

  const handleSphere = async () => {
    try {
      const g = await api.createSphere(numericProjectId, {
        radius:   Number(sphereParams.radius),
        center_x: parseFloat(sphereParams.center_x) || 0,
        center_y: parseFloat(sphereParams.center_y) || 0,
        center_z: parseFloat(sphereParams.center_z) || 0,
        mesh_settings: buildSettings(),
      })
      await loadWorkspaceData(`Sphere meshed · ${(g.mesh?.node_count || 0).toLocaleString()} nodes`)
    } catch (e) { pushToast(e?.body?.detail || 'Failed to create sphere.', 'error') }
  }

  const handleCylinder = async () => {
    try {
      const g = await api.createCylinder(numericProjectId, {
        radius: Number(cylParams.radius),
        height: Number(cylParams.height),
        base_x: parseFloat(cylParams.base_x) || 0,
        base_y: parseFloat(cylParams.base_y) || 0,
        base_z: parseFloat(cylParams.base_z) || 0,
        mesh_settings: buildSettings(),
      })
      await loadWorkspaceData(`Cylinder meshed · ${(g.mesh?.node_count || 0).toLocaleString()} nodes`)
    } catch (e) { pushToast(e?.body?.detail || 'Failed to create cylinder.', 'error') }
  }

  const handleCadUpload = async (file) => {
    const f = file || cadFile
    if (!f) { pushToast('Choose a STEP, IGES, BREP, STL, VTK, or MSH file first.', 'warning'); return }
    try {
      pushToast(`Importing ${f.name}…`, 'info')
      const g = await api.uploadCAD(numericProjectId, f)
      setCadFile(null)
      await loadWorkspaceData(`Imported ${f.name} · geometry #${g.id}`)
    } catch (e) { pushToast(e?.body?.detail || 'Failed to upload CAD or mesh.', 'error') }
  }

  const handleDeleteGeom = async (id) => {
    try {
      await api.deleteGeometry(numericProjectId, id)
      if (selectedGeomId === id) setSelectedGeomId(null)
      await loadWorkspaceData(`Geometry #${id} deleted`)
    } catch (e) { pushToast(e?.body?.detail || 'Failed to delete geometry.', 'error') }
  }

  // ── Drag-and-drop CAD onto viewport ──────────────────────────────────────
  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }
  const handleDrop      = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const ext     = file.name.split('.').pop().toLowerCase()
    const allowed = ['step', 'stp', 'iges', 'igs', 'brep', 'stl', 'vtk', 'msh']
    if (!allowed.includes(ext)) { pushToast(`Unsupported format: .${ext}`, 'error'); return }
    await handleCadUpload(file)
  }

  const dismissHint = () => {
    setShowHint(false)
    localStorage.setItem('webmsh_viewport_hint_v1', '1')
  }

  // ── Empty viewport card action — expand sidebar + scroll to section ────────
  const handleEmptyViewportAction = (sectionId) => {
    // Always switch to geometry stage and expand sidebar first
    setActiveStage('geometry')
    setCollapsed(false)
    // After sidebar expand animation (200ms), scroll the section into view
    setTimeout(() => {
      const el = document.getElementById(sectionId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Brief highlight flash on the target section
        el.style.transition = 'box-shadow 0.15s ease'
        el.style.boxShadow  = '0 0 0 2px rgba(99,102,241,0.4)'
        setTimeout(() => { el.style.boxShadow = '' }, 900)
      } else if (sidebarBodyRef.current) {
        sidebarBodyRef.current.scrollTop = 0
      }
    }, 230)
  }

  // ── Stage panel content ───────────────────────────────────────────────────
  const renderStageContent = () => {
    switch (activeStage) {

      case 'geometry':
        return (
          <div className="space-y-5">
            {/* Primitives */}
            <section id="ws-primitives" className="space-y-2.5 scroll-mt-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Primitives</h3>
              <div className="space-y-3">

                {/* Box */}
                <div className="rounded-lg border border-slate-800/70 bg-slate-900/20 p-3 space-y-2.5">
                  <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#4b8fea' }} />
                    Box
                  </h4>
                  <div className="grid grid-cols-3 gap-1.5">
                    <SideInput label="Size X" value={boxParams.width}    onChange={e => setBoxParams({ ...boxParams, width:    e.target.value })} />
                    <SideInput label="Size Y" value={boxParams.height}   onChange={e => setBoxParams({ ...boxParams, height:   e.target.value })} />
                    <SideInput label="Size Z" value={boxParams.depth}    onChange={e => setBoxParams({ ...boxParams, depth:    e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <SideInput label="Pos X"  value={boxParams.origin_x} onChange={e => setBoxParams({ ...boxParams, origin_x: e.target.value })} />
                    <SideInput label="Pos Y"  value={boxParams.origin_y} onChange={e => setBoxParams({ ...boxParams, origin_y: e.target.value })} />
                    <SideInput label="Pos Z"  value={boxParams.origin_z} onChange={e => setBoxParams({ ...boxParams, origin_z: e.target.value })} />
                  </div>
                  <Button variant="secondary" size="sm" className="w-full mt-1" onClick={handleBox}>Create Box</Button>
                </div>

                {/* Sphere */}
                <div className="rounded-lg border border-slate-800/70 bg-slate-900/20 p-3 space-y-2.5">
                  <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#f5c542' }} />
                    Sphere
                  </h4>
                  <div className="grid grid-cols-4 gap-1.5">
                    <SideInput label="Radius" value={sphereParams.radius}   onChange={e => setSphereParams({ ...sphereParams, radius:   e.target.value })} />
                    <SideInput label="Pos X"  value={sphereParams.center_x} onChange={e => setSphereParams({ ...sphereParams, center_x: e.target.value })} />
                    <SideInput label="Pos Y"  value={sphereParams.center_y} onChange={e => setSphereParams({ ...sphereParams, center_y: e.target.value })} />
                    <SideInput label="Pos Z"  value={sphereParams.center_z} onChange={e => setSphereParams({ ...sphereParams, center_z: e.target.value })} />
                  </div>
                  <Button variant="secondary" size="sm" className="w-full mt-1" onClick={handleSphere}>Create Sphere</Button>
                </div>

                {/* Cylinder */}
                <div className="rounded-lg border border-slate-800/70 bg-slate-900/20 p-3 space-y-2.5">
                  <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#5ad35a' }} />
                    Cylinder
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    <SideInput label="Radius" value={cylParams.radius} onChange={e => setCylParams({ ...cylParams, radius: e.target.value })} />
                    <SideInput label="Height" value={cylParams.height} onChange={e => setCylParams({ ...cylParams, height: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <SideInput label="Pos X" value={cylParams.base_x} onChange={e => setCylParams({ ...cylParams, base_x: e.target.value })} />
                    <SideInput label="Pos Y" value={cylParams.base_y} onChange={e => setCylParams({ ...cylParams, base_y: e.target.value })} />
                    <SideInput label="Pos Z" value={cylParams.base_z} onChange={e => setCylParams({ ...cylParams, base_z: e.target.value })} />
                  </div>
                  <Button variant="secondary" size="sm" className="w-full mt-1" onClick={handleCylinder}>Create Cylinder</Button>
                </div>

                {/* Import CAD */}
                <div id="ws-import" className="rounded-lg border border-slate-800/70 bg-slate-900/20 p-3 space-y-2.5 scroll-mt-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#7ad4ff' }} />
                    Import CAD / Mesh
                  </h4>
                  <div className="relative flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/30 px-4 py-4 text-center transition hover:bg-slate-900/50 hover:border-indigo-500/40">
                    <input type="file" accept=".step,.stp,.iges,.igs,.brep,.stl,.vtk,.msh"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      onChange={e => setCadFile(e.target.files?.[0] || null)} />
                    <div className="pointer-events-none">
                      <p className="text-xs text-indigo-400 font-medium truncate max-w-[180px]">{cadFile ? cadFile.name : 'Choose or drop a file'}</p>
                      <p className="text-[10px] text-slate-600 mt-1">STEP · IGES · BREP · STL · VTK · MSH</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full mt-1" onClick={() => handleCadUpload()} disabled={!cadFile}>
                    Upload &amp; Mesh
                  </Button>
                </div>
              </div>
            </section>

            {/* 2D Sketches */}
            <div id="ws-sketch" className="scroll-mt-2">
              <SketchPanel
                projectId={numericProjectId}
                meshSettings={meshSettings}
                onCreated={msg => loadWorkspaceData(msg)}
                onError={msg => pushToast(msg, 'error')}
              />
            </div>

            {/* 3D Operations */}
            <OperationsPanel
              projectId={numericProjectId}
              geoms={geoms}
              meshSettings={meshSettings}
              onCreated={msg => loadWorkspaceData(msg)}
              onError={msg => pushToast(msg, 'error')}
            />
          </div>
        )

      case 'mesh':
        return (
          <div className="space-y-4">
            <MeshSettingsPanel settings={meshSettings} onChange={setMeshSettings} />
            {/* Algorithm reference */}
            <div className="rounded-lg border border-slate-800/70 bg-slate-900/20 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Algorithm Guide</p>
              {[
                { name: 'Default',                desc: 'Gmsh auto-selects based on geometry' },
                { name: 'MeshAdapt (1)',           desc: 'Adaptive refinement; slow but accurate' },
                { name: 'Delaunay (5)',            desc: 'Fast triangulation; good general use' },
                { name: 'Frontal (6)',             desc: 'Advancing-front; highest mesh quality' },
                { name: 'Frontal-Delaunay (8)',    desc: 'Hybrid; good when quads needed downstream' },
              ].map(a => (
                <div key={a.name} className="text-[10px] leading-relaxed">
                  <span className="text-slate-400 font-medium">{a.name}</span>
                  <span className="text-slate-600"> — {a.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )

      case 'label':
        return (
          <LabelStagePanel
            selectedGeom={selectedGeom}
            projectId={numericProjectId}
            onRefresh={() => loadWorkspaceData()}
            pushToast={pushToast}
          />
        )

      case 'export':
        return (
          <ExportStagePanel
            selectedGeom={selectedGeom}
            projectId={numericProjectId}
            pushToast={pushToast}
            health={health}
            info={info}
          />
        )

      default:
        return null
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F] text-slate-300 selection:bg-indigo-500/30 font-sans">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`flex flex-col border-r border-slate-800/80 bg-[#0B0D13] transition-[width] duration-200 ease-in-out shrink-0 ${collapsed ? 'w-[52px]' : 'w-[300px]'}`}>

        {/* Brand row */}
        <div className="flex h-12 items-center justify-between border-b border-slate-800/80 px-3 gap-2 shrink-0">
          <div className={`flex items-center gap-2 min-w-0 overflow-hidden transition-all duration-150 ${collapsed ? 'w-0 opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <WebMshLogo size={26} color="#5aaddb" />
            <div className="flex flex-col min-w-0 leading-none">
              <span className="text-[13px] font-bold text-slate-200 tracking-tight">WebMsh</span>
              <span className="text-[10px] text-slate-600 truncate">{project?.name || '…'}</span>
            </div>
          </div>
          {collapsed && <div className="w-full flex justify-center"><WebMshLogo size={22} color="#5aaddb" /></div>}
          <button onClick={() => setCollapsed(c => !c)}
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:bg-slate-800 hover:text-slate-300 transition-colors focus:outline-none">
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        {/* Stage tabs — horizontal, only when expanded */}
        {!collapsed && (
          <div id="ws-tour-stage-tabs" className="flex shrink-0 border-b border-slate-800/80">
            {STAGES.map(({ id, label, Icon }) => (
              <button key={id}
                id={`ws-stage-tab-${id}`}
                onClick={() => setActiveStage(id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-semibold uppercase tracking-wider transition-all duration-150 border-b-2 ${
                  activeStage === id
                    ? 'text-indigo-400 border-indigo-500 bg-indigo-500/5'
                    : 'text-slate-600 border-transparent hover:text-slate-400 hover:bg-slate-800/30'
                }`}>
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Scrollable stage content + geometry list */}
        {!collapsed && (
          <div ref={sidebarBodyRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 space-y-5">

            {/* Active stage form */}
            {renderStageContent()}

            {/* Geometry list — always visible across all stages */}
            <section id="ws-tour-geom-list" className="space-y-2 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Geometries{geoms.length > 0 && <span className="text-slate-700 ml-1">({geoms.length})</span>}
                </h3>
                <button onClick={() => loadWorkspaceData('Workspace refreshed.')} title="Refresh"
                  className="text-slate-600 hover:text-indigo-400 transition-colors p-1 rounded hover:bg-indigo-500/10 focus:outline-none">
                  <RefreshIcon />
                </button>
              </div>

              {geoms.length > 0 ? (
                <div className="space-y-1">
                  {geoms.map(g => (
                    <GeometryItem
                      key={g.id}
                      g={g}
                      projectId={numericProjectId}
                      selected={selectedGeomId === g.id}
                      onSelect={id => setSelectedGeomId(prev => prev === id ? null : id)}
                      onDelete={handleDeleteGeom}
                      onRefresh={() => loadWorkspaceData()}
                    />
                  ))}
                </div>
              ) : !loading && (
                <p className="text-[11px] text-slate-700 py-2">
                  No geometries yet. Create one above.
                </p>
              )}
            </section>

            {/* Navigation footer */}
            <div className="border-t border-slate-800/60 pt-3 grid grid-cols-2 gap-2 pb-4">
              <Button variant="secondary" size="sm" onClick={() => navigate('/profile')}>Profile</Button>
              <Button variant="danger"    size="sm" onClick={onLogout}>Sign Out</Button>
            </div>
          </div>
        )}

        {/* Collapsed — icon-only stage tabs */}
        {collapsed && (
          <div className="flex flex-col items-center pt-3 gap-1">
            {STAGES.map(({ id, label, Icon }) => (
              <button key={id} title={label}
                onClick={() => { setCollapsed(false); setActiveStage(id) }}
                className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${
                  activeStage === id ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                }`}>
                <Icon />
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ── Viewport ────────────────────────────────────────────────────── */}
      <main className="relative flex-1"
        ref={mountRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#090A0F]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
              <p className="text-[11px] font-medium tracking-widest text-indigo-300 uppercase">Meshing…</p>
            </div>
          </div>
        )}

        {/* Drag-over overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-indigo-500/50 bg-indigo-500/5 pointer-events-none">
            <div className="rounded-xl border border-indigo-500/40 bg-[#0B0D13]/90 px-8 py-5 text-center backdrop-blur-md">
              <p className="text-sm font-semibold text-indigo-300">Drop to import</p>
              <p className="text-xs text-slate-500 mt-1">STEP · IGES · BREP · STL · VTK · MSH</p>
            </div>
          </div>
        )}

        {/* Empty state — shown when no geometries */}
        {!loading && geoms.length === 0 && !dragOver && (
          <EmptyViewport onAction={handleEmptyViewportAction} />
        )}

        {/* Mesh stats HUD — top right */}
        {!loading && geoms.length > 0 && (
          <div className="absolute top-4 right-4 z-10 pointer-events-none select-none">
            <div className="rounded-lg border border-slate-800/60 bg-[#0B0D13]/85 px-3 py-2.5 shadow-xl backdrop-blur-md">
              {selectedGeom ? (
                <div className="space-y-0.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-indigo-400/80 mb-1.5">
                    {selectedGeom.type.replace(/_/g, ' ')} <span className="text-slate-600">#{selectedGeom.id}</span>
                  </p>
                  <p className="text-[11px] font-mono text-slate-300">
                    {(selectedGeom.mesh?.node_count || 0).toLocaleString()} <span className="text-slate-600">nodes</span>
                  </p>
                  <p className="text-[11px] font-mono text-slate-300">
                    {(selectedGeom.mesh?.triangle_count || 0).toLocaleString()} <span className="text-slate-600">triangles</span>
                  </p>
                  {selectedGeom.params?.labels?.length > 0 && (
                    <p className="text-[10px] text-emerald-400/90 mt-1.5 font-mono">
                      {selectedGeom.params.labels.join(' · ')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Workspace</p>
                  <p className="text-[11px] font-mono text-slate-300">
                    {totalNodes.toLocaleString()} <span className="text-slate-600">nodes</span>
                  </p>
                  <p className="text-[11px] font-mono text-slate-300">
                    {totalTris.toLocaleString()} <span className="text-slate-600">triangles</span>
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    {geoms.length} {geoms.length === 1 ? 'geometry' : 'geometries'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Controls hint — bottom left */}
        <div id="ws-tour-controls-hint" className="absolute bottom-5 left-5 z-10 select-none">
          <div className="rounded-lg border border-slate-800/60 bg-[#0B0D13]/80 px-3 py-2.5 shadow-xl backdrop-blur-md pointer-events-none">
            <div className="flex flex-col gap-1 text-[10px] tracking-wide text-slate-600">
              <p>Orbit <span className="text-slate-700 ml-1">drag</span></p>
              <p>Pan   <span className="text-slate-700 ml-1">right-drag</span></p>
              <p>Zoom  <span className="text-slate-700 ml-1">scroll</span></p>
            </div>
            {!loading && (
              <div className="mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-indigo-400/70 font-medium truncate max-w-[140px]">
                {project?.name || `Project #${projectId}`}
              </div>
            )}
          </div>
          {/* Tour trigger — always accessible */}
          {!loading && (
            <button onClick={startTour}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-md border border-slate-800/60 bg-[#0B0D13]/80 px-3 py-1.5 text-[10px] font-medium text-slate-600 hover:text-indigo-400 hover:border-indigo-500/30 transition-colors backdrop-blur-md pointer-events-auto focus:outline-none">
              <span className="text-[9px] font-bold text-slate-700">?</span> Take a tour
            </button>
          )}
        </div>

        {/* Onboarding hint pill — bottom center, first-time only */}
        {showHint && !loading && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10">
            <div style={{ animation: 'wsToastIn 0.35s cubic-bezier(0.32,0.72,0,1) both' }}
              className="flex items-center gap-3 rounded-full border border-slate-700/60 bg-[#0B0D13]/90 px-5 py-2 shadow-xl backdrop-blur-md">
              <span className="text-[11px] text-slate-400">
                Drag to orbit · Scroll to zoom · Click a geometry to select it
              </span>
              <button onClick={dismissHint}
                className="text-slate-600 hover:text-slate-300 text-base leading-none transition focus:outline-none" aria-label="Dismiss hint">
                ×
              </button>
            </div>
          </div>
        )}

        {/* First-time tour prompt — auto-appears for new users */}
        {showTourPrompt && !tourActive && !loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20"
            style={{ animation: 'wsToastIn 0.35s cubic-bezier(0.32,0.72,0,1) both' }}>
            <div className="flex items-center gap-3 rounded-full border border-indigo-500/35 bg-[#0D0F17]/92 px-5 py-2.5 shadow-2xl backdrop-blur-md">
              <span className="text-[11px] text-slate-300 font-medium">New to WebMsh?</span>
              <button onClick={startTour}
                className="rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500 transition focus:outline-none">
                Take the tour
              </button>
              <button onClick={() => { setShowTourPrompt(false); localStorage.setItem('webmsh_tour_seen_v1', '1') }}
                className="text-slate-600 hover:text-slate-400 text-sm leading-none transition focus:outline-none" aria-label="Dismiss">
                ×
              </button>
            </div>
          </div>
        )}

        {/* Toast notifications */}
        <ToastArea toasts={toasts} />
      </main>

      {/* Product tour — rendered outside <main> to cover the full viewport */}
      {tourActive && (
        <ProductTour
          onDone={endTour}
          setActiveStage={setActiveStage}
          setCollapsed={setCollapsed}
        />
      )}

      {/* Global keyframe for toast/hint animations */}
      <style>{`
        @keyframes wsToastIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default Workspace

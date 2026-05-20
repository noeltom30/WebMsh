import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { api } from './api'
import { useTheme } from './hooks/useTheme'
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
const ChatIcon         = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M21 11.5a8.38 8.38 0 0 1-1.5 4.5L21 21l-4.5-1.5A8.38 8.38 0 0 1 12 21a9 9 0 1 1 9-9z"/><circle cx="8.5" cy="11" r="1"/><circle cx="12" cy="11" r="1"/><circle cx="15.5" cy="11" r="1"/></svg>)

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
  { id: 'assistant', label: 'Assist',  Icon: ChatIcon },
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
  const navigate = useNavigate()
  const { theme } = useTheme()
  const mountRef        = useRef(null)
  const sceneRef        = useRef(null)
  const geomGroupRef    = useRef(null)
  const geomObjectsRef  = useRef(new Map())
  const toastIdRef      = useRef(0)
  const assistantEndRef = useRef(null)

  const [collapsed,       setCollapsed]       = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [health,          setHealth]          = useState(null)
  const [info,            setInfo]            = useState(null)
  const [project,         setProject]         = useState(null)
  const [geoms,           setGeoms]           = useState([])
  const [lastAction,      setLastAction]      = useState('')
  const [selectedGeomId,  setSelectedGeomId]  = useState(null)
  const [toasts,          setToasts]          = useState([])
  const [activeStage,     setActiveStage]     = useState('geometry')
  const [tourActive,      setTourActive]      = useState(false)
  const [showTourPrompt,  setShowTourPrompt]  = useState(false)
  const [assistantMessages, setAssistantMessages] = useState([])
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantBusy, setAssistantBusy] = useState(false)

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
  // startTour can be called from the "?" button at any time — no localStorage gate
  const startTour = useCallback(() => {
    setShowTourPrompt(false)
    setCollapsed(false)
    setActiveStage('geometry')
    setTourActive(true)
  }, [])

  // Mark seen only when the user explicitly finishes or skips
  const endTour = useCallback(() => {
    setTourActive(false)
    localStorage.setItem('webmsh_tour_seen_v1', '1')
  }, [])

  // Auto-prompt new users after workspace loads (once per browser)
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('webmsh_tour_seen_v1')) return
    const t = setTimeout(() => setShowTourPrompt(true), 2800)
    return () => clearTimeout(t)
  }, [loading])

  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [assistantMessages, assistantBusy])

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
    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color(theme === 'light' ? '#e7f0f8' : '#0a0c10')
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
    
    // Grid changes based on initial theme, but dynamic updating is handled in next effect
    const grid = new THREE.GridHelper(10, 20, theme === 'light' ? 0x73bde9 : 0x2c3140, theme === 'light' ? 0xb4d8f1 : 0x1c202b)
    grid.name = 'gridHelper'
    scene.add(grid)
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
  }, []) // Empty dependency array, setup once

  // Update theme dynamically in Three.js
  useEffect(() => {
    if (!sceneRef.current) return
    const isLight = theme === 'light'
    sceneRef.current.background = new THREE.Color(isLight ? '#e7f0f8' : '#0a0c10')
    
    // Recreate grid
    const oldGrid = sceneRef.current.getObjectByName('gridHelper')
    if (oldGrid) {
      sceneRef.current.remove(oldGrid)
      oldGrid.geometry.dispose()
      oldGrid.material.dispose()
    }
    const grid = new THREE.GridHelper(10, 20, isLight ? 0x73bde9 : 0x2c3140, isLight ? 0xb4d8f1 : 0x1c202b)
    grid.name = 'gridHelper'
    sceneRef.current.add(grid)
  }, [theme])

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

  const handleAssistantSend = async () => {
    const prompt = assistantInput.trim()
    if (!prompt || assistantBusy) return
    const userMessage = { role: 'user', content: prompt }
    const history = [...assistantMessages, userMessage]
      .slice(-8)
      .map(({ role, content }) => ({ role, content }))
    setAssistantMessages(prev => [...prev, userMessage])
    setAssistantInput('')
    setAssistantBusy(true)
    try {
      const response = await api.assistantChat({
        project_id: numericProjectId,
        prompt,
        history,
      })
      setAssistantMessages(prev => [
        ...prev,
        { role: 'assistant', content: response?.message || 'Done.', actions: response?.actions || [] },
      ])
      if (response?.actions?.length) {
        await loadWorkspaceData('Assistant updated the workspace')
      }
    } catch (err) {
      const message = err?.body?.detail || 'Assistant request failed.'
      setAssistantMessages(prev => [...prev, { role: 'assistant', content: message }])
      pushToast(message, 'error')
    } finally {
      setAssistantBusy(false)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-sky-50 dark:bg-[#090A0F] text-slate-800 dark:text-slate-300 selection:bg-sky-500/30 dark:selection:bg-indigo-500/30 font-sans">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`flex flex-col border-r border-sky-200 dark:border-slate-800 bg-white/80 dark:bg-[#0B0D13] backdrop-blur-sm transition-[width] duration-200 ease-in-out shrink-0 relative ${collapsed ? 'w-[48px]' : 'w-[300px]'}`}>

        {/* Brand */}
        <div className="flex h-12 items-center justify-between border-b border-sky-200 dark:border-slate-800 px-3 gap-1.5 shrink-0">
          <div className={`flex items-center gap-2 min-w-0 transition-opacity duration-150 ${collapsed ? 'opacity-0 pointer-events-none w-0 overflow-hidden' : 'opacity-100'}`}>
            <WebMshLogo size={26} className="text-[#0f6fac] dark:text-[#5aaddb]" />
            <span className="text-[15px] font-extrabold tracking-[-0.03em] bg-clip-text text-transparent bg-gradient-to-br from-[#0a3d62] via-[#1573a8] to-[#0e5f99] dark:from-white dark:via-[#7ed4f7] dark:to-[#4ab8ef] whitespace-nowrap">WebMsh</span>
          </div>
          {collapsed && (
            <div className="flex items-center justify-center w-full">
              <WebMshLogo size={22} className="text-[#0f6fac] dark:text-[#5aaddb]" />
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {/* Tour help button — always visible */}
            {!collapsed && (
              <button onClick={startTour} title="Start product tour"
                className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-indigo-500 hover:text-sky-600 dark:hover:text-indigo-400 hover:bg-sky-50 dark:hover:bg-indigo-500/10 transition-colors focus:outline-none">
                ?
              </button>
            )}
            <button onClick={() => setCollapsed(c => !c)}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:bg-sky-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors focus:outline-none">
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>
        </div>

        {/* ── Expanded sidebar ── */}
        {!collapsed && (
          <>
            {/* Stage tabs */}
            <div id="ws-tour-stage-tabs" className="flex shrink-0 border-b border-sky-200 dark:border-slate-800">
              {STAGES.map(({ id, label, Icon }) => (
                <button key={id} id={`ws-stage-tab-${id}`} onClick={() => setActiveStage(id)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9px] font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
                    activeStage === id
                      ? 'border-sky-500 dark:border-indigo-500 text-sky-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400'
                  }`}>
                  <Icon />
                  {label}
                </button>
              ))}
            </div>

            {/* Stage content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 space-y-4">

              {/* ── GEOMETRY ──────────────────────────────────────── */}
              {activeStage === 'geometry' && (
                <div className="space-y-4">

                  {/* Project info */}
                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Project</h3>
                    <div className="rounded border border-sky-200 dark:border-slate-800/80 bg-sky-50/40 dark:bg-slate-900/20 p-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Name</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate pl-2">{project?.name || 'Loading…'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">ID</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{projectId}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">User</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-right truncate pl-2">{user?.email || '--'}</span>
                      </div>
                    </div>
                  </section>

                  {/* Primitives */}
                  <section id="ws-primitives" className="space-y-2.5 scroll-mt-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Add Primitives</h3>
                    <div className="space-y-2.5">

                      {/* Box */}
                      <div className="rounded border border-sky-200 dark:border-slate-800/80 bg-sky-50/40 dark:bg-slate-900/20 p-3 space-y-2">
                        <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">Box</h4>
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
                      <div className="rounded border border-sky-200 dark:border-slate-800/80 bg-sky-50/40 dark:bg-slate-900/20 p-3 space-y-2">
                        <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">Sphere</h4>
                        <div className="grid grid-cols-4 gap-1.5">
                          <SideInput label="Radius"  value={sphereParams.radius}   onChange={e => setSphereParams({ ...sphereParams, radius:   e.target.value })} />
                          <SideInput label="Pos X"   value={sphereParams.center_x} onChange={e => setSphereParams({ ...sphereParams, center_x: e.target.value })} />
                          <SideInput label="Pos Y"   value={sphereParams.center_y} onChange={e => setSphereParams({ ...sphereParams, center_y: e.target.value })} />
                          <SideInput label="Pos Z"   value={sphereParams.center_z} onChange={e => setSphereParams({ ...sphereParams, center_z: e.target.value })} />
                        </div>
                        <Button variant="secondary" size="sm" className="w-full mt-1" onClick={handleSphere}>Create Sphere</Button>
                      </div>

                      {/* Cylinder */}
                      <div className="rounded border border-sky-200 dark:border-slate-800/80 bg-sky-50/40 dark:bg-slate-900/20 p-3 space-y-2">
                        <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">Cylinder</h4>
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
                      <div id="ws-import" className="rounded border border-sky-200 dark:border-slate-800/80 bg-sky-50/40 dark:bg-slate-900/20 p-3 space-y-2">
                        <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">Import CAD / Mesh</h4>
                        <div className="relative flex flex-col items-center justify-center rounded border border-dashed border-sky-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/30 px-4 py-4 text-center transition hover:border-sky-400 dark:hover:border-indigo-500/40 hover:bg-sky-50 dark:hover:bg-slate-900/50">
                          <input type="file" accept=".step,.stp,.iges,.igs,.brep,.stl,.vtk,.msh"
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleCadUpload(f) }} />
                          <div className="pointer-events-none">
                            <p className="text-xs text-sky-600 dark:text-indigo-400 font-medium truncate max-w-[180px]">{cadFile ? cadFile.name : 'Choose a file'}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">STEP · IGES · BREP · STL · VTK · MSH</p>
                          </div>
                        </div>
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

                  {/* Geometry list */}
                  <section id="ws-tour-geom-list" className="space-y-2 scroll-mt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Geometry ({geoms.length})
                      </h3>
                      <button onClick={() => loadWorkspaceData()}
                        className="p-1 rounded text-slate-400 dark:text-slate-600 hover:text-sky-600 dark:hover:text-indigo-400 hover:bg-sky-100 dark:hover:bg-indigo-500/10 transition focus:outline-none" title="Refresh">
                        <RefreshIcon />
                      </button>
                    </div>
                    {geoms.length === 0
                      ? <p className="text-[10px] text-slate-400 dark:text-slate-600 italic">No geometry yet — add a primitive above.</p>
                      : (
                        <div className="space-y-1.5">
                          {geoms.map(g => (
                            <GeometryItem key={g.id} g={g} projectId={numericProjectId}
                              selected={selectedGeomId === g.id}
                              onSelect={id => setSelectedGeomId(prev => prev === id ? null : id)}
                              onDelete={handleDeleteGeom}
                              onRefresh={() => loadWorkspaceData()}
                            />
                          ))}
                        </div>
                      )
                    }
                  </section>
                </div>
              )}

              {/* ── MESH ──────────────────────────────────────────── */}
              {activeStage === 'mesh' && (
                <div className="space-y-4">
                  <MeshSettingsPanel settings={meshSettings} onChange={setMeshSettings} />
                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Geometry</h3>
                    {geoms.length === 0
                      ? <p className="text-[10px] text-slate-400 dark:text-slate-600 italic">No geometry yet.</p>
                      : (
                        <div className="space-y-1.5">
                          {geoms.map(g => (
                            <GeometryItem key={g.id} g={g} projectId={numericProjectId}
                              selected={selectedGeomId === g.id}
                              onSelect={id => setSelectedGeomId(prev => prev === id ? null : id)}
                              onDelete={handleDeleteGeom}
                              onRefresh={() => loadWorkspaceData()}
                            />
                          ))}
                        </div>
                      )
                    }
                  </section>
                </div>
              )}

              {/* ── LABEL ─────────────────────────────────────────── */}
              {activeStage === 'label' && (
                <div className="space-y-4">
                  <LabelStagePanel
                    selectedGeom={selectedGeom}
                    projectId={numericProjectId}
                    onRefresh={() => loadWorkspaceData()}
                    pushToast={pushToast}
                  />
                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Select Geometry</h3>
                    <div className="space-y-1.5">
                      {geoms.map(g => (
                        <GeometryItem key={g.id} g={g} projectId={numericProjectId}
                          selected={selectedGeomId === g.id}
                          onSelect={id => setSelectedGeomId(prev => prev === id ? null : id)}
                          onDelete={handleDeleteGeom}
                          onRefresh={() => loadWorkspaceData()}
                        />
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {/* ── EXPORT ────────────────────────────────────────── */}
              {activeStage === 'export' && (
                <div className="space-y-4">
                  <ExportStagePanel
                    selectedGeom={selectedGeom}
                    projectId={numericProjectId}
                    pushToast={pushToast}
                    health={health}
                    info={info}
                  />
                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Select Geometry</h3>
                    <div className="space-y-1.5">
                      {geoms.map(g => (
                        <GeometryItem key={g.id} g={g} projectId={numericProjectId}
                          selected={selectedGeomId === g.id}
                          onSelect={id => setSelectedGeomId(prev => prev === id ? null : id)}
                          onDelete={handleDeleteGeom}
                          onRefresh={() => loadWorkspaceData()}
                        />
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {/* ── ASSISTANT ─────────────────────────────────────── */}
              {activeStage === 'assistant' && (
                <div className="space-y-4">
                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">AI Assistant</h3>
                    <div className="rounded border border-sky-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/30 p-3">
                      <div className="flex flex-col gap-2 max-h-64 min-h-[180px] overflow-y-auto pr-1">
                        {assistantMessages.length === 0 && !assistantBusy && (
                          <p className="text-[11px] text-slate-500">
                            Ask me to create, delete, or remesh geometry in this project.
                          </p>
                        )}
                        {assistantMessages.map((msg, idx) => {
                          const isUser = msg.role === 'user'
                          const actionSummary = msg.actions?.length
                            ? msg.actions.map(a => a.detail).join(' · ')
                            : ''
                          return (
                            <div
                              key={`${msg.role}-${idx}`}
                              className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
                                isUser
                                  ? 'ml-auto bg-sky-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-800/60'
                              }`}>
                              <p>{msg.content}</p>
                              {!isUser && actionSummary && (
                                <p className="mt-1 text-[9px] text-slate-500 dark:text-slate-400">
                                  Actions: {actionSummary}
                                </p>
                              )}
                            </div>
                          )
                        })}
                        {assistantBusy && (
                          <div className="max-w-[85%] rounded-lg px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/60">
                            Thinking…
                          </div>
                        )}
                        <div ref={assistantEndRef} />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <textarea
                      value={assistantInput}
                      onChange={e => setAssistantInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAssistantSend()
                        }
                      }}
                      rows={3}
                      placeholder="e.g. Create a 2x1x1 box at the origin, then delete geometry 3"
                      className="w-full resize-none rounded border border-slate-300 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/40 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 shadow-sm focus:border-sky-500/60 dark:focus:border-indigo-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40 dark:focus:ring-indigo-500/40"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Shift+Enter for a new line.</span>
                      <button
                        onClick={handleAssistantSend}
                        disabled={assistantBusy || !assistantInput.trim()}
                        className="h-7 px-3 rounded border border-sky-300 dark:border-indigo-500/40 bg-sky-50 dark:bg-indigo-500/10 text-sky-700 dark:text-indigo-300 font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed">
                        {assistantBusy ? 'Working…' : 'Send'}
                      </button>
                    </div>
                  </section>

                  <div className="text-[10px] text-slate-500 leading-relaxed">
                    Examples: “Add a cylinder radius 0.5 height 2 at x=1 y=0 z=0”, “Extrude sketch 2 by 3”, “Remesh geometry 5 with min size 0.05 max 0.2”.
                  </div>
                </div>
              )}
            </div>

            {/* Nav footer */}
            <div className="shrink-0 border-t border-sky-200 dark:border-slate-800/60 p-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => navigate('/profile')}>Profile</Button>
              <Button variant="danger"    size="sm" onClick={onLogout}>Sign Out</Button>
            </div>
          </>
        )}

        {/* Collapsed — icon-only stage tabs */}
        {collapsed && (
          <div className="flex flex-col items-center pt-3 gap-1">
            {STAGES.map(({ id, label, Icon }) => (
              <button key={id} title={label}
                onClick={() => { setCollapsed(false); setActiveStage(id) }}
                className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${
                  activeStage === id
                    ? 'text-sky-600 dark:text-indigo-400 bg-sky-100 dark:bg-indigo-500/10'
                    : 'text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400 hover:bg-sky-100 dark:hover:bg-slate-800'
                }`}>
                <Icon />
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ── Viewport ─────────────────────────────────────────────────────── */}
      <main className="relative flex-1" ref={mountRef}>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-sky-50/80 dark:bg-[#090A0F]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400/30 dark:border-indigo-500/30 border-t-sky-500 dark:border-t-indigo-500" />
              <p className="text-xs font-medium tracking-wider text-sky-600 dark:text-indigo-300 uppercase">Loading Workspace</p>
            </div>
          </div>
        )}

        {/* Empty viewport hint */}
        {!loading && geoms.length === 0 && (
          <EmptyViewport onAction={sectionId => {
            setCollapsed(false)
            setActiveStage('geometry')
            setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
          }} />
        )}

        {/* Stats HUD — top right */}
        {!loading && geoms.length > 0 && (
          <div className="absolute top-4 right-4 z-10 pointer-events-none">
            <div className="rounded border border-sky-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-[#0B0D13]/80 px-3 py-2 shadow-xl backdrop-blur-md text-[10px] font-mono space-y-0.5">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Nodes</span>
                <span className="text-sky-600 dark:text-indigo-400 font-semibold">{totalNodes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Tris</span>
                <span className="text-sky-600 dark:text-indigo-400 font-semibold">{totalTris.toLocaleString()}</span>
              </div>
              {selectedGeom && (
                <div className="pt-1 border-t border-sky-200 dark:border-slate-800/60 text-[9px] text-sky-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">
                  {selectedGeom.type.replace(/_/g, ' ')} #{selectedGeom.id}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Controls hint */}
        <div id="ws-tour-controls-hint" className="absolute bottom-5 left-5 z-10 pointer-events-none">
          <div className="rounded border border-sky-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-[#0B0D13]/80 p-3 shadow-xl backdrop-blur-md">
            <div className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <p>Orbit <span className="text-slate-400 dark:text-slate-600 lowercase mx-1">drag</span></p>
              <p>Pan   <span className="text-slate-400 dark:text-slate-600 lowercase mx-1">right-drag</span></p>
              <p>Zoom  <span className="text-slate-400 dark:text-slate-600 lowercase mx-1">scroll</span></p>
            </div>
            <div className="mt-3 pt-2 border-t border-sky-200 dark:border-slate-800/60 text-[11px] text-sky-600 dark:text-indigo-400 font-medium">
              {!loading && (project?.name || `Project #${projectId}`)}
            </div>
          </div>
        </div>

        {/* Toast notifications */}
        <ToastArea toasts={toasts} />
      </main>

      {/* ── Tour prompt (auto-shown for new users) ───────────────────────── */}
      {showTourPrompt && !tourActive && (
        <div style={{ position: 'fixed', bottom: 88, right: 20, zIndex: 8000, animation: 'wsToastIn 0.3s ease both' }}
          className="rounded-xl border border-indigo-500/30 bg-[#0D0F17]/95 p-4 shadow-2xl backdrop-blur-md w-72">
          <p className="text-xs font-bold text-slate-100 mb-1">New to WebMsh?</p>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-3">Take a quick 5-step tour to learn the mesh pipeline.</p>
          <div className="flex gap-2">
            <button onClick={startTour}
              className="flex-1 h-7 rounded bg-indigo-600 text-[10px] font-semibold text-white hover:bg-indigo-500 transition focus:outline-none">
              Start Tour
            </button>
            <button onClick={() => { setShowTourPrompt(false); localStorage.setItem('webmsh_tour_seen_v1', '1') }}
              className="h-7 px-3 rounded border border-slate-700 text-[10px] text-slate-500 hover:text-slate-300 transition focus:outline-none">
              Skip
            </button>
          </div>
        </div>
      )}

      {/* ── Product tour overlay ─────────────────────────────────────────── */}
      {tourActive && (
        <ProductTour
          onDone={endTour}
          setActiveStage={setActiveStage}
          setCollapsed={setCollapsed}
        />
      )}

      {/* Global keyframe */}
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

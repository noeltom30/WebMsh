import { useEffect, useState } from 'react'
import { api } from '../../api'

const PRESET_LABELS  = ['wall', 'inlet', 'outlet', 'support', 'load', 'symmetry']
const EXPORT_FORMATS = ['msh', 'stl', 'vtk', 'obj']
const SKETCH_TYPES   = ['sketch_rectangle', 'sketch_circle', 'sketch_polygon']

// Plain-English descriptions for engineering jargon shown on hover
const MESH_TOOLTIPS = {
  minSize:   'Smallest allowed edge length. Lower = finer mesh, preserves small features.',
  maxSize:   'Largest allowed edge length. Higher = coarser mesh, faster to generate.',
  order1:    'Linear (1st-order) elements — faster solver, less accurate.',
  order2:    'Quadratic (2nd-order) elements — more accurate, larger mesh file.',
  algDefault:'Gmsh chooses automatically based on geometry type.',
  alg1:      'MeshAdapt — adaptive refinement; slower but produces high-quality elements.',
  alg5:      'Delaunay — fast general-purpose triangulation.',
  alg6:      'Frontal (Delaunay) — advancing-front method; best element quality.',
  alg8:      'Frontal-Delaunay hybrid — good when quad elements are needed downstream.',
}

// Color per geometry type, matching the Three.js viewport colors
const TYPE_CSS_COLORS = {
  box:              '#4b8fea',
  sphere:           '#f5c542',
  cylinder:         '#5ad35a',
  sketch_rectangle: '#2dd4bf',
  sketch_circle:    '#2dd4bf',
  sketch_polygon:   '#2dd4bf',
  extrude:          '#f97316',
  revolve:          '#f97316',
  upload:           '#7ad4ff',
  cad:              '#7ad4ff',
}

// ── Shared tiny input ─────────────────────────────────────────────────────────
export function SideInput({ label, value, onChange, type = 'number', step = '0.1', min }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</label>
      <input
        type={type} step={step} value={value} onChange={onChange} min={min}
        className="h-8 w-full rounded border border-slate-700/80 bg-slate-900/40 px-2 text-xs text-slate-300 shadow-sm transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:bg-[#0B0D13] focus:outline-none focus:ring-1 focus:ring-indigo-500/60"
      />
    </div>
  )
}

function SideSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</label>
      <select value={value} onChange={onChange}
        className="h-8 w-full rounded border border-slate-700/80 bg-slate-900/60 px-2 text-xs text-slate-300 focus:border-indigo-500/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/60">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Mesh Settings Panel ───────────────────────────────────────────────────────
export function MeshSettingsPanel({ settings, onChange }) {
  const set = (key, val) => onChange({ ...settings, [key]: val })
  return (
    <section className="space-y-2.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Mesh Settings</h3>
      <div className="rounded-lg border border-slate-800/70 bg-slate-900/20 p-3 space-y-3">
        {/* Presets */}
        <div className="flex gap-1.5">
          <button title="Coarse: max size 0.5, algorithm Frontal"
            onClick={() => onChange({ mesh_size_min: 0.2, mesh_size_max: 0.5, mesh_order: 1, algorithm: 6 })}
            className="flex-1 h-7 rounded bg-slate-800 border border-slate-700 text-[10px] font-medium text-slate-300 hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-indigo-300 transition">
            Coarse
          </button>
          <button title="Fine: max size 0.1, algorithm Frontal"
            onClick={() => onChange({ mesh_size_min: 0.02, mesh_size_max: 0.1, mesh_order: 1, algorithm: 6 })}
            className="flex-1 h-7 rounded bg-slate-800 border border-slate-700 text-[10px] font-medium text-slate-300 hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-indigo-300 transition">
            Fine
          </button>
          <button title="Reset to Gmsh defaults"
            onClick={() => onChange({ mesh_size_min: null, mesh_size_max: null, mesh_order: 1, algorithm: null })}
            className="flex-1 h-7 rounded bg-slate-800 border border-slate-700 text-[10px] font-medium text-slate-500 hover:text-slate-300 transition">
            Reset
          </button>
        </div>

        {/* Size controls with engineering tooltips */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1">
              Min Size
              <span title={MESH_TOOLTIPS.minSize} className="cursor-help text-slate-700 hover:text-slate-500 transition">?</span>
            </label>
            <input type="number" step="0.01" value={settings.mesh_size_min ?? ''} title={MESH_TOOLTIPS.minSize}
              onChange={e => set('mesh_size_min', e.target.value === '' ? null : Number(e.target.value))}
              className="h-8 w-full rounded border border-slate-700/80 bg-slate-900/40 px-2 text-xs text-slate-300 shadow-sm transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:bg-[#0B0D13] focus:outline-none focus:ring-1 focus:ring-indigo-500/60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1">
              Max Size
              <span title={MESH_TOOLTIPS.maxSize} className="cursor-help text-slate-700 hover:text-slate-500 transition">?</span>
            </label>
            <input type="number" step="0.01" value={settings.mesh_size_max ?? ''} title={MESH_TOOLTIPS.maxSize}
              onChange={e => set('mesh_size_max', e.target.value === '' ? null : Number(e.target.value))}
              className="h-8 w-full rounded border border-slate-700/80 bg-slate-900/40 px-2 text-xs text-slate-300 shadow-sm transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:bg-[#0B0D13] focus:outline-none focus:ring-1 focus:ring-indigo-500/60" />
          </div>
        </div>

        {/* Order and algorithm with tooltips */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1">
              Order
              <span title={`${MESH_TOOLTIPS.order1} | ${MESH_TOOLTIPS.order2}`} className="cursor-help text-slate-700 hover:text-slate-500 transition">?</span>
            </label>
            <select value={settings.mesh_order}
              onChange={e => set('mesh_order', Number(e.target.value))}
              className="h-8 w-full rounded border border-slate-700/80 bg-slate-900/60 px-2 text-xs text-slate-300 focus:border-indigo-500/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/60">
              <option value={1} title={MESH_TOOLTIPS.order1}>1st order</option>
              <option value={2} title={MESH_TOOLTIPS.order2}>2nd order</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1">
              Algorithm
              <span title="Triangulation algorithm. Frontal (6) gives best quality." className="cursor-help text-slate-700 hover:text-slate-500 transition">?</span>
            </label>
            <select value={settings.algorithm ?? ''}
              onChange={e => set('algorithm', e.target.value === '' ? null : Number(e.target.value))}
              className="h-8 w-full rounded border border-slate-700/80 bg-slate-900/60 px-2 text-xs text-slate-300 focus:border-indigo-500/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/60">
              <option value=""  title={MESH_TOOLTIPS.algDefault}>Default</option>
              <option value={1} title={MESH_TOOLTIPS.alg1}>MeshAdapt</option>
              <option value={5} title={MESH_TOOLTIPS.alg5}>Delaunay</option>
              <option value={6} title={MESH_TOOLTIPS.alg6}>Frontal</option>
              <option value={8} title={MESH_TOOLTIPS.alg8}>Frontal-Delaunay</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── 2D Sketch Panel ──────────────────────────────────────────────────────────
export function SketchPanel({ projectId, meshSettings, onCreated, onError }) {
  const [tab, setTab] = useState('rect')
  const [busy, setBusy] = useState(false)

  const [rect, setRect] = useState({ width: 2, height: 1, origin_x: 0, origin_y: 0, z: 0 })
  const [circle, setCircle] = useState({ radius: 1, center_x: 0, center_y: 0, z: 0 })
  const [polyPts, setPolyPts] = useState([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }])
  const [polyZ, setPolyZ] = useState(0)

  const buildSettings = () => {
    const s = meshSettings
    if (!s.mesh_size_min && !s.mesh_size_max && !s.algorithm) return null
    return {
      mesh_size_min: s.mesh_size_min || null,
      mesh_size_max: s.mesh_size_max || null,
      mesh_order: s.mesh_order || 1,
      algorithm: s.algorithm || null,
    }
  }

  const run = async (fn) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const handleRect = () => run(async () => {
    try {
      const g = await api.createSketchRect(projectId, { ...rect, mesh_settings: buildSettings() })
      onCreated(`Created rectangle sketch #${g.id}`)
    } catch (e) { onError(e?.body?.detail || 'Failed to create rectangle sketch') }
  })

  const handleCircle = () => run(async () => {
    try {
      const g = await api.createSketchCircle(projectId, { ...circle, mesh_settings: buildSettings() })
      onCreated(`Created circle sketch #${g.id}`)
    } catch (e) { onError(e?.body?.detail || 'Failed to create circle sketch') }
  })

  const handlePolygon = () => run(async () => {
    try {
      const g = await api.createSketchPolygon(projectId, { points: polyPts, z: polyZ, mesh_settings: buildSettings() })
      onCreated(`Created polygon sketch #${g.id}`)
    } catch (e) { onError(e?.body?.detail || 'Failed to create polygon sketch') }
  })

  const tabs = [{ id: 'rect', label: 'Rect' }, { id: 'circle', label: 'Circle' }, { id: 'poly', label: 'Polygon' }]

  return (
    <section className="space-y-2.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Create 2D Sketch</h3>
      <div className="rounded border border-slate-800/80 bg-slate-900/20 p-3 space-y-3">
        <div className="flex rounded overflow-hidden border border-slate-700/60">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 h-7 text-[10px] font-semibold uppercase tracking-wider transition ${tab === t.id ? 'bg-indigo-600/40 text-indigo-300 border-none' : 'bg-transparent text-slate-500 hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'rect' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <SideInput label="Width" value={rect.width} onChange={e => setRect({ ...rect, width: e.target.value })} />
              <SideInput label="Height" value={rect.height} onChange={e => setRect({ ...rect, height: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <SideInput label="Pos X" value={rect.origin_x} onChange={e => setRect({ ...rect, origin_x: e.target.value })} />
              <SideInput label="Pos Y" value={rect.origin_y} onChange={e => setRect({ ...rect, origin_y: e.target.value })} />
              <SideInput label="Z" value={rect.z} onChange={e => setRect({ ...rect, z: e.target.value })} />
            </div>
            <button disabled={busy} onClick={handleRect}
              className="w-full h-8 mt-1 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-indigo-300 transition disabled:opacity-40">
              {busy ? 'Creating…' : 'Create Rectangle'}
            </button>
          </div>
        )}

        {tab === 'circle' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <SideInput label="Radius" value={circle.radius} onChange={e => setCircle({ ...circle, radius: e.target.value })} />
              <SideInput label="Z" value={circle.z} onChange={e => setCircle({ ...circle, z: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <SideInput label="Center X" value={circle.center_x} onChange={e => setCircle({ ...circle, center_x: e.target.value })} />
              <SideInput label="Center Y" value={circle.center_y} onChange={e => setCircle({ ...circle, center_y: e.target.value })} />
            </div>
            <button disabled={busy} onClick={handleCircle}
              className="w-full h-8 mt-1 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-indigo-300 transition disabled:opacity-40">
              {busy ? 'Creating…' : 'Create Circle'}
            </button>
          </div>
        )}

        {tab === 'poly' && (
          <div className="space-y-2">
            <SideInput label="Z plane" value={polyZ} onChange={e => setPolyZ(e.target.value)} />
            <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
              {polyPts.map((pt, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <SideInput label={`P${i + 1} X`} value={pt.x} onChange={e => { const n = [...polyPts]; n[i] = { ...pt, x: e.target.value }; setPolyPts(n) }} />
                  <SideInput label={`P${i + 1} Y`} value={pt.y} onChange={e => { const n = [...polyPts]; n[i] = { ...pt, y: e.target.value }; setPolyPts(n) }} />
                  {polyPts.length > 3 && (
                    <button onClick={() => setPolyPts(polyPts.filter((_, j) => j !== i))}
                      className="mt-4 shrink-0 text-slate-600 hover:text-rose-400 text-xs transition">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setPolyPts([...polyPts, { x: 0, y: 0 }])}
              className="w-full h-7 rounded border border-dashed border-slate-700 text-[10px] text-slate-500 hover:text-indigo-400 hover:border-indigo-500/40 transition">
              + Add Point
            </button>
            <button disabled={busy} onClick={handlePolygon}
              className="w-full h-8 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-indigo-300 transition disabled:opacity-40">
              {busy ? 'Creating…' : 'Create Polygon'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Operations Panel ─────────────────────────────────────────────────────────
export function OperationsPanel({ projectId, geoms, meshSettings, onCreated, onError }) {
  const sketches = geoms.filter(g => SKETCH_TYPES.includes(g.type))
  const [sourceId, setSourceId] = useState('')
  const [height, setHeight] = useState(1)
  const [angle, setAngle] = useState(360)
  const [busy, setBusy] = useState('')

  const buildSettings = () => {
    const s = meshSettings
    if (!s.mesh_size_min && !s.mesh_size_max && !s.algorithm) return null
    return { mesh_size_min: s.mesh_size_min || null, mesh_size_max: s.mesh_size_max || null, mesh_order: s.mesh_order || 1, algorithm: s.algorithm || null }
  }

  const handleExtrude = async () => {
    if (!sourceId) return onError('Select a sketch geometry first')
    setBusy('extrude')
    try {
      const g = await api.extrudeGeometry(projectId, Number(sourceId), { height: Number(height), mesh_settings: buildSettings() })
      onCreated(`Extruded sketch #${sourceId} → geometry #${g.id}`)
    } catch (e) { onError(e?.body?.detail || 'Extrude failed') }
    finally { setBusy('') }
  }

  const handleRevolve = async () => {
    if (!sourceId) return onError('Select a sketch geometry first')
    setBusy('revolve')
    try {
      const g = await api.revolveGeometry(projectId, Number(sourceId), { angle_degrees: Number(angle), mesh_settings: buildSettings() })
      onCreated(`Revolved sketch #${sourceId} → geometry #${g.id}`)
    } catch (e) { onError(e?.body?.detail || 'Revolve failed') }
    finally { setBusy('') }
  }

  if (sketches.length === 0) return null

  return (
    <section className="space-y-2.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">3D Operations</h3>
      <div className="rounded border border-slate-800/80 bg-slate-900/20 p-3 space-y-3">
        <SideSelect label="Source Sketch" value={sourceId} onChange={e => setSourceId(e.target.value)}
          options={[{ value: '', label: '— select —' }, ...sketches.map(g => ({ value: g.id, label: `${g.type} #${g.id}` }))]} />
        <div className="grid grid-cols-2 gap-1.5">
          <div className="space-y-1.5">
            <SideInput label="Extrude Height" value={height} step="0.1" onChange={e => setHeight(e.target.value)} />
            <button disabled={!!busy || !sourceId} onClick={handleExtrude}
              className="w-full h-8 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-indigo-300 transition disabled:opacity-40">
              {busy === 'extrude' ? 'Working…' : 'Extrude'}
            </button>
          </div>
          <div className="space-y-1.5">
            <SideInput label="Revolve °" value={angle} step="1" min="1" onChange={e => setAngle(e.target.value)} />
            <button disabled={!!busy || !sourceId} onClick={handleRevolve}
              className="w-full h-8 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-indigo-300 transition disabled:opacity-40">
              {busy === 'revolve' ? 'Working…' : 'Revolve'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Geometry List Item ───────────────────────────────────────────────────────
export function GeometryItem({ g, projectId, selected, onSelect, onDelete, onRefresh }) {
  const [showLabels,   setShowLabels]   = useState(false)
  const [activeLabels, setActiveLabels] = useState(g.params?.labels || [])
  const [exportBusy,   setExportBusy]   = useState(false)
  const [labelBusy,    setLabelBusy]    = useState(false)
  const [showExport,   setShowExport]   = useState(false)

  // Keep local label state in sync if parent refreshes the geometry data
  useEffect(() => {
    setActiveLabels(g.params?.labels || [])
  }, [JSON.stringify(g.params?.labels)]) // eslint-disable-line

  // Color dot matches the Three.js viewport color for this type
  const typeCssColor = TYPE_CSS_COLORS[g.type] || '#6366f1'

  const toggleLabel = async (label) => {
    const next = activeLabels.includes(label)
      ? activeLabels.filter(l => l !== label)
      : [...activeLabels, label]
    setActiveLabels(next)
    setLabelBusy(true)
    try {
      await api.updateGeometryLabels(projectId, g.id, { labels: next })
      onRefresh()
    } catch { setActiveLabels(activeLabels) }
    finally { setLabelBusy(false) }
  }

  const handleExport = async (fmt) => {
    setExportBusy(true)
    setShowExport(false)
    try { await api.exportGeometry(projectId, g.id, fmt) }
    catch (e) { console.error('Export failed:', e?.body?.detail || e) }
    finally { setExportBusy(false) }
  }

  const nodes = g.mesh?.node_count    ?? 0
  const tris  = g.mesh?.triangle_count ?? 0

  return (
    <div onClick={() => onSelect(g.id)}
      className={`group rounded-lg border p-2.5 transition-all duration-150 cursor-pointer ${
        selected
          ? 'border-indigo-500/50 bg-indigo-500/8 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]'
          : 'border-slate-800/70 bg-slate-900/20 hover:border-indigo-500/25 hover:bg-indigo-500/5'
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col overflow-hidden flex-1 min-w-0">
          {/* Type label with color dot matching viewport */}
          <span className="text-xs font-semibold capitalize flex items-center gap-1.5" style={{ color: typeCssColor }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: typeCssColor }} />
            {g.type.replace(/_/g, ' ')} <span className="text-slate-500 font-normal">#{g.id}</span>
          </span>
          {nodes > 0 && (
            <span className="text-[10px] text-slate-500 mt-0.5">{nodes.toLocaleString()} nodes · {tris.toLocaleString()} tris</span>
          )}
          {activeLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {activeLabels.map(l => (
                <span key={l} className="px-1.5 py-0.5 rounded-sm bg-emerald-500/15 text-emerald-400 text-[9px] font-semibold uppercase tracking-wider">{l}</span>
              ))}
            </div>
          )}
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(g.id) }}
          className="shrink-0 flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:bg-rose-500/10 hover:text-rose-400 transition opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>

      {selected && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 space-y-2" onClick={e => e.stopPropagation()}>
          {/* Labels */}
          <div className="space-y-1">
            <button onClick={() => setShowLabels(v => !v)}
              className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-indigo-400 transition flex items-center gap-1">
              <span>{showLabels ? '▾' : '▸'}</span> Labels
              {labelBusy && <span className="ml-1 text-[9px] text-slate-600">saving…</span>}
            </button>
            {showLabels && (
              <div className="flex flex-wrap gap-1">
                {PRESET_LABELS.map(l => (
                  <button key={l} onClick={() => toggleLabel(l)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border transition ${activeLabels.includes(l) ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Export */}
          {g.mesh && (
            <div className="relative">
              <button onClick={() => setShowExport(v => !v)} disabled={exportBusy}
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-indigo-400 transition flex items-center gap-1 disabled:opacity-40">
                <span>{showExport ? '▾' : '▸'}</span> {exportBusy ? 'Downloading…' : 'Export'}
              </button>
              {showExport && (
                <div className="mt-1 flex gap-1 flex-wrap">
                  {EXPORT_FORMATS.map(fmt => (
                    <button key={fmt} onClick={() => handleExport(fmt)}
                      className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 hover:bg-indigo-600/20 hover:border-indigo-500/40 hover:text-indigo-300 uppercase transition">
                      .{fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

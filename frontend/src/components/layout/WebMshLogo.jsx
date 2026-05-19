/**
 * WebMshLogo — pure SVG recreation of the geometric mandala reference image.
 * 8-pointed star with 4 concentric triangulated rings radiating from centre.
 */
export default function WebMshLogo({ size = 36, color, className }) {
  const C = 50

  /** Return [x, y] at given degree and radius, centred at (50,50). */
  const pt = (deg, r) => {
    const a = (deg * Math.PI) / 180
    return [+(C + r * Math.cos(a)).toFixed(2), +(C + r * Math.sin(a)).toFixed(2)]
  }

  // Radii of the four concentric rings
  const R_TIP = 46   // outer star tips
  const R_VAL = 32   // valleys between tips (inner edge of star)
  const R_MID = 22   // middle ring
  const R_INN = 12   // inner ring

  // 0 = top, clockwise, 8-fold symmetry
  const tips = Array.from({ length: 8 }, (_, i) => pt(-90 + i * 45, R_TIP))
  const vals = Array.from({ length: 8 }, (_, i) => pt(-90 + 22.5 + i * 45, R_VAL))
  const mids = Array.from({ length: 8 }, (_, i) => pt(-90 + i * 45, R_MID))
  const inns = Array.from({ length: 8 }, (_, i) => pt(-90 + 22.5 + i * 45, R_INN))
  const O = [C, C]

  const mod8 = (i) => ((i % 8) + 8) % 8

  /** Build an SVG line segment string. */
  const seg = ([ax, ay], [bx, by]) => `M${ax},${ay}L${bx},${by}`

  const segs = []

  for (let i = 0; i < 8; i++) {
    const j = mod8(i + 1)

    // ── Outer star boundary ──────────────────────────────────────────────────
    segs.push(seg(tips[i], vals[i]))       // tip → right-valley
    segs.push(seg(vals[i], tips[j]))       // valley → next tip

    // ── Radials: centre → tip & centre → valley ──────────────────────────────
    segs.push(seg(O, tips[i]))
    segs.push(seg(O, vals[i]))

    // ── Tips → valley ring (connecting outer star to mid ring) ───────────────
    segs.push(seg(tips[i], vals[mod8(i - 1)]))  // tip → left-adjacent valley
    segs.push(seg(tips[i], mids[i]))             // tip → directly below (mid ring)

    // ── Outer ring → mid ring triangles ─────────────────────────────────────
    segs.push(seg(vals[i], mids[i]))
    segs.push(seg(vals[i], mids[j]))

    // ── Mid ring octagon ─────────────────────────────────────────────────────
    segs.push(seg(mids[i], mids[j]))

    // ── Mid ring diagonals (cross-cuts) ──────────────────────────────────────
    segs.push(seg(mids[i], vals[mod8(i - 1)]))  // to left valley
    segs.push(seg(mids[i], inns[i]))             // mid → inner-valley below
    segs.push(seg(mids[i], inns[mod8(i - 1)]))  // mid → inner-valley left

    // ── Inner ring octagon ───────────────────────────────────────────────────
    segs.push(seg(inns[i], inns[j]))

    // ── Inner ring → centre ──────────────────────────────────────────────────
    segs.push(seg(inns[i], O))

    // ── Cross-connects between mid and inner rings ───────────────────────────
    segs.push(seg(vals[i], inns[i]))
    segs.push(seg(mids[j], inns[i]))
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="WebMsh logo"
      className={className}
    >
      <path
        d={segs.join(' ')}
        stroke={color || "currentColor"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

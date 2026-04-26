import { Link } from 'react-router-dom'
import PublicNavbar from '../components/layout/PublicNavbar'
import Button from '../components/ui/Button'
import { useAuth } from '../context/useAuth'

const FEATURES = [
  {
    title: 'Primitive Geometry Creation',
    text: 'Create boxes, spheres, and cylinders quickly as the first step in your meshing workflow.',
  },
  {
    title: 'CAD Upload Support',
    text: 'Import STEP, IGES, BREP, STL, VTK, or MSH files directly into your browser workflow.',
  },
  {
    title: 'Surface Mesh Generation',
    text: 'Generate mesh representations for geometry and CAD models with backend processing.',
  },
  {
    title: 'Real-Time 3D Visualization',
    text: 'Inspect geometry and mesh outputs in the integrated interactive 3D workspace.',
  },
  {
    title: 'Secure Authentication',
    text: 'Email OTP login, optional authenticator 2FA, and Google OAuth for modern account security.',
  },
  {
    title: 'Browser-Based Workflow',
    text: 'No heavy local CAD desktop setup required to start reviewing and iterating mesh assets.',
  },
]

const VALUE_POINTS = [
  'No installation needed',
  'Fast workflow from geometry to visualization',
  'Secure accounts with OTP and optional 2FA',
  'Engineering-focused tools for mesh teams',
]

const STATS = [
  { label: 'Browser-Based Setup', value: '5 min' },
  { label: 'Supported CAD Formats', value: '8+' },
  { label: 'Secure Auth Layers', value: '3' },
]

const FOOTER_LINKS = [
  { label: 'Contact', href: 'mailto:decentmomo.000@gmail.com' },
  { label: 'GitHub', href: 'https://github.com', external: true },
  { label: 'Privacy', href: '#' },
  { label: 'Terms', href: '#' },
]

function FeatureCard({ title, text }) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-[linear-gradient(170deg,rgba(15,23,42,0.92),rgba(15,23,42,0.7))] p-6 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_24px_55px_-28px_rgba(56,189,248,0.5)]">
      <div className="inline-flex rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-cyan-200/90">
        Capability
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{text}</p>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-cyan-300/0 via-cyan-300/40 to-cyan-300/0 opacity-0 transition group-hover:opacity-100" />
    </article>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 backdrop-blur-sm transition duration-300 hover:border-cyan-300/35">
      <p className="text-xl font-bold text-slate-100">{value}</p>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
    </div>
  )
}

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <PublicNavbar />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(99,102,241,0.3),transparent_40%),radial-gradient(circle_at_86%_65%,rgba(56,189,248,0.2),transparent_42%),linear-gradient(180deg,rgba(11,15,25,0.2),rgba(11,15,25,0.95))]" />
          <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-5 py-16 sm:px-8 md:py-20 lg:grid-cols-[1.05fr,0.95fr] lg:py-24">
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 animate-fade-in-up">
                Engineering SaaS Workspace
              </p>
              <h1 className="mt-6 text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl animate-fade-in-up [animation-delay:120ms]">
                Browser-Based Geometry & Mesh Workspace
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg animate-fade-in-up [animation-delay:220ms]">
                Create geometry, upload CAD files, generate meshes, and visualize 3D models directly in your browser.
              </p>
              <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center animate-fade-in-up [animation-delay:320ms]">
                <Link to={user ? '/workspace' : '/signup'}>
                  <Button size="lg" className="w-full sm:w-auto">Start Building in WebMsh</Button>
                </Link>
                <Link to="/workspace">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">Explore Interactive Demo</Button>
                </Link>
              </div>
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 animate-fade-in-up [animation-delay:420ms]">
                {STATS.map((item) => (
                  <StatCard key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="animate-float-slow rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-soft">
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200">WebMsh Workspace Preview</span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">Live</span>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    <div className="col-span-2 rounded-lg border border-white/10 bg-slate-900 p-3">
                      <p className="text-xs text-slate-400">Geometry</p>
                      <p className="mt-2 text-sm text-slate-200">Box / Sphere / Cylinder</p>
                    </div>
                    <div className="col-span-4 rounded-lg border border-white/10 bg-slate-900 p-3">
                      <p className="text-xs text-slate-400">3D Viewport</p>
                      <div className="mt-2 h-24 rounded bg-[linear-gradient(135deg,rgba(99,102,241,0.25),rgba(15,23,42,0.7))]" />
                    </div>
                    <div className="col-span-6 rounded-lg border border-white/10 bg-slate-900 p-3">
                      <p className="text-xs text-slate-400">Meshing Status</p>
                      <div className="mt-2 h-2 rounded-full bg-slate-800">
                        <div className="h-2 w-3/4 rounded-full bg-indigo-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
          <div className="mb-10 max-w-2xl animate-fade-in-up">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Platform Highlights</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Feature Highlights</h2>
            <p className="mt-3 text-slate-300">
              Built for practical geometry and meshing workflows with secure access, clean UX, and production-ready API integration.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} title={feature.title} text={feature.text} />
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(165deg,rgba(30,41,59,0.85),rgba(15,23,42,0.92))] p-6 sm:p-8 lg:flex lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">Why Choose WebMsh</h2>
              <ul className="mt-5 space-y-3 text-slate-300">
                {VALUE_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-cyan-300" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div id="pricing" className="mt-8 max-w-md rounded-2xl border border-white/10 bg-slate-950/70 p-5 lg:mt-0">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Pricing</p>
              <h3 className="mt-2 text-xl font-semibold">Flexible plans coming soon</h3>
              <p className="mt-3 text-sm text-slate-300">
                Start with the current platform capabilities and scale with team-ready plans.
              </p>
              <div className="mt-5">
                <Link to={user ? '/workspace' : '/signup'}>
                  <Button variant="outline" className="w-full sm:w-auto">Join Early Access</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950/90">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 text-sm text-slate-400 sm:px-8 md:grid-cols-2 md:items-center md:justify-between">
          <div>
            <p className="text-slate-200">© {new Date().getFullYear()} WebMsh</p>
            <p className="mt-1 text-xs text-slate-500">Built for geometry and meshing teams that ship faster.</p>
          </div>
          <div className="flex flex-wrap items-center gap-5 md:justify-end">
            {FOOTER_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                className="transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

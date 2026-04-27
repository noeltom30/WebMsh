import { Link } from 'react-router-dom'
import PublicNavbar from '../components/layout/PublicNavbar'
import Button from '../components/ui/Button'
import { useAuth } from '../context/useAuth'

const PRODUCT_FEATURES = [
  {
    title: 'Secure Authentication',
    text: 'Protect engineering work with email OTP, optional authenticator 2FA, and Google OAuth sign-in.',
  },
  {
    title: 'Persistent Projects',
    text: 'Keep project work organized with named workspaces that store geometry and mesh data per account.',
  },
  {
    title: '3D Mesh Visualization',
    text: 'Inspect geometry and mesh results interactively in the browser with a responsive Three.js viewport.',
  },
  {
    title: 'CAD + Gmsh Pipeline',
    text: 'Upload supported CAD and mesh files, then generate or inspect surfaces with backend Gmsh integration.',
  },
]

const WORKFLOW_STEPS = [
  {
    label: '01',
    title: 'Create project',
    text: 'Start with a clean project space so each model and mesh iteration stays organized.',
  },
  {
    label: '02',
    title: 'Add geometry or upload CAD',
    text: 'Build primitives quickly or import engineering files into the same browser-based workspace.',
  },
  {
    label: '03',
    title: 'View mesh in 3D',
    text: 'Inspect the returned mesh in the live viewport and continue iterating from a saved project state.',
  },
]

const METRICS = [
  { label: 'Secure sign-in layers', value: '3' },
  { label: 'Supported CAD/mesh formats', value: '8+' },
  { label: 'Project-based workspace', value: 'Persistent' },
]

const GITHUB_URL = 'https://github.com/noeltom30/WebMsh'

function FeatureCard({ title, text }) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-[linear-gradient(165deg,rgba(15,23,42,0.92),rgba(15,23,42,0.78))] p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_24px_48px_-28px_rgba(56,189,248,0.5)]">
      <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
        Feature
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{text}</p>
    </article>
  )
}

function StepCard({ label, title, text }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-soft transition duration-300 hover:border-cyan-300/30">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{label}</div>
      <h3 className="mt-3 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{text}</p>
    </article>
  )
}

function MetricCard({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/75 px-4 py-4 backdrop-blur-sm transition duration-300 hover:border-cyan-300/35">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(14,165,233,0.22),transparent_38%),radial-gradient(circle_at_88%_20%,rgba(99,102,241,0.18),transparent_34%),linear-gradient(180deg,rgba(11,15,25,0.12),rgba(11,15,25,0.94))]" />
          <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.08fr,0.92fr] lg:py-24">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 animate-fade-in-up">
                WebMsh Platform
              </p>
              <h1 className="mt-6 text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl animate-fade-in-up [animation-delay:100ms]">
                Web-based geometry and meshing workspace for engineers
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg animate-fade-in-up [animation-delay:220ms]">
                Build geometry, upload CAD, inspect meshes, and manage persistent engineering projects in one secure browser-based workflow.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center animate-fade-in-up [animation-delay:320ms]">
                <Link to="/auth">
                  <Button size="lg" className="w-full sm:w-auto">Get Started</Button>
                </Link>
                {user ? (
                  <Link to="/profile">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto">View Projects</Button>
                  </Link>
                ) : (
                  <Link to="/auth">
                    <Button size="lg" variant="ghost" className="w-full sm:w-auto">Sign In</Button>
                  </Link>
                )}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3 animate-fade-in-up [animation-delay:420ms]">
                {METRICS.map((metric) => (
                  <MetricCard key={metric.label} value={metric.value} label={metric.label} />
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-soft backdrop-blur animate-float-slow">
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200">Workspace Snapshot</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">Projects Live</span>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Current Project</p>
                        <p className="mt-2 text-sm font-semibold text-slate-100">Wing Mesh Validation</p>
                        <p className="mt-1 text-xs text-slate-400">Project-scoped geometry and saved mesh state</p>
                      </div>
                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                        Synced
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[0.85fr,1.15fr]">
                      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Geometry Tools</p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-200">
                          <li>Box, Sphere, Cylinder</li>
                          <li>CAD upload pipeline</li>
                          <li>Project-linked mesh persistence</li>
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">3D Viewport</p>
                        <div className="mt-3 h-36 rounded-2xl bg-[linear-gradient(135deg,rgba(14,165,233,0.24),rgba(15,23,42,0.76)),radial-gradient(circle_at_75%_30%,rgba(99,102,241,0.32),transparent_40%)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Key Features</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Purpose-built for geometry and mesh workflows</h2>
            <p className="mt-3 text-slate-300">
              WebMsh combines secure access, persistent project management, and browser-based 3D visualization in one engineering-focused experience.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {PRODUCT_FEATURES.map((feature) => (
              <FeatureCard key={feature.title} title={feature.title} text={feature.text} />
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(165deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))] p-6 shadow-soft sm:p-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">How It Works</p>
              <h2 className="mt-2 text-3xl font-bold text-white">From project setup to 3D inspection</h2>
              <p className="mt-3 text-slate-300">
                Keep the workflow simple while preserving the security and persistence expected from a real engineering SaaS platform.
              </p>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {WORKFLOW_STEPS.map((step) => (
                <StepCard key={step.label} label={step.label} title={step.title} text={step.text} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950/90">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-slate-400 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-slate-200">© {new Date().getFullYear()} WebMsh</p>
            <p className="mt-1 text-xs text-slate-500">A browser-based geometry and meshing workspace for modern engineering teams.</p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Public Landing Page</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

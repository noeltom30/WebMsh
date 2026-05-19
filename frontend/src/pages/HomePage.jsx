import { Link } from 'react-router-dom'
import PublicNavbar from '../components/layout/PublicNavbar'
import { useAuth } from '../context/useAuth'
import './HomePage.css'
import ShapeGrid from '../components/ui/ShapeGrid'

const PRODUCT_FEATURES = [
  {
    title: 'Zero-friction secure access',
    text: 'Email OTP, optional authenticator 2FA, and Google OAuth keep engineering teams fast and protected.',
    tag: 'Identity',
  },
  {
    title: 'Persistent project memory',
    text: 'Every geometry, upload, and mesh state is preserved inside project-scoped workspaces for confident iteration.',
    tag: 'Projects',
  },
  {
    title: 'Real-time 3D inspection',
    text: 'Interact with mesh outputs directly in-browser with fluid viewport controls and responsive rendering.',
    tag: 'Visualization',
  },
  {
    title: 'CAD to mesh pipeline',
    text: 'Move from CAD import to generated mesh with a clean Gmsh-backed path designed for engineering velocity.',
    tag: 'Pipeline',
  },
]

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Start a focused project',
    text: 'Create a dedicated workspace so model changes and mesh outputs stay organized from day one.',
  },
  {
    step: '02',
    title: 'Build or import geometry',
    text: 'Use primitives for fast exploration or upload CAD files into the same collaborative context.',
  },
  {
    step: '03',
    title: 'Generate and inspect mesh',
    text: 'Review results in 3D, refine quickly, and continue from persistent state across sessions.',
  },
]

const METRICS = [
  { value: '8+', label: 'Supported formats' },
  { value: '3', label: 'Secure auth layers' },
  { value: '<2s', label: 'Average scene load' },
]

const GITHUB_URL = 'https://github.com/noeltom30/WebMsh'

function FeatureCard({ feature }) {
  return (
    <article className="cursor-target landing-feature-card">
      <p className="landing-feature-tag">{feature.tag}</p>
      <h3>{feature.title}</h3>
      <p>{feature.text}</p>
    </article>
  )
}

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className="landing-root">
      <div style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw', height: '100vh',
        zIndex: 0,
        pointerEvents: 'none'
      }}>
        <ShapeGrid
          speed={0.03}
          squareSize={40}
          direction="diagonal"
          borderColor="#1b2b44"
          hoverFillColor="#4b559e"
          shape="triangle"
          hoverTrailAmount={8}
          hoverColor="#4b559e"
        />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PublicNavbar />

        <main className="landing-main">
          <section className="landing-hero">
            <div className="landing-hero-glow" aria-hidden />
            <div className="landing-hero-grid" aria-hidden />

            <div className="landing-container landing-hero-content">
              <div className="landing-copy">
                <p className="landing-eyebrow">WebMsh engineering platform</p>
                <h1>Design-ready meshing workflows with startup-grade UX precision.</h1>
                <p className="landing-description">
                  WebMsh combines secure access, project persistence, and fluid browser-based 3D tooling into one polished product surface built for modern engineering teams.
                </p>

                <div className="landing-cta-row">
                  <Link to={user ? '/profile' : '/auth'} className="cursor-target landing-btn landing-btn-primary">
                    {user ? 'Open Dashboard' : 'Start Building'}
                  </Link>
                  <a href="#features" className="cursor-target landing-btn landing-btn-muted">Explore capabilities</a>
                </div>

                <div className="landing-metrics">
                  {METRICS.map((metric) => (
                    <div key={metric.label} className="cursor-target landing-metric-card">
                      <p>{metric.value}</p>
                      <span>{metric.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="landing-preview-card">
                <header>
                  <div>
                    <p className="landing-eyebrow">Live workspace</p>
                    <h2>Wing mesh validation</h2>
                  </div>
                  <span className="landing-status-badge">Synced</span>
                </header>

                <div className="landing-preview-chart" aria-hidden />

                <div className="landing-preview-list">
                  <div className="cursor-target">
                    <p>Geometry primitives</p>
                    <span>Box, sphere, cylinder</span>
                  </div>
                  <div className="cursor-target">
                    <p>Mesh revision</p>
                    <span>Saved to project state</span>
                  </div>
                  <div className="cursor-target">
                    <p>CAD pipeline</p>
                    <span>Upload and validate</span>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section id="features" className="landing-section">
            <div className="landing-container">
              <div className="landing-section-header">
                <p className="landing-eyebrow">Capabilities</p>
                <h2>Everything needed to ship mesh-ready geometry at team speed.</h2>
              </div>
              <div className="landing-feature-grid">
                {PRODUCT_FEATURES.map((feature) => (
                  <FeatureCard key={feature.title} feature={feature} />
                ))}
              </div>
            </div>
          </section>

          <section id="how-it-works" className="landing-section">
            <div className="landing-container">
              <div className="landing-workflow-shell">
                <div className="landing-section-header">
                  <p className="landing-eyebrow">Workflow</p>
                  <h2>A clean path from concept geometry to production mesh review.</h2>
                </div>

                <div className="landing-workflow-grid">
                  {WORKFLOW_STEPS.map((item) => (
                    <article key={item.step} className="cursor-target landing-workflow-card">
                      <span>{item.step}</span>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="landing-footer">
          <div className="landing-container landing-footer-content">
            <div>
              <p>© {new Date().getFullYear()} WebMsh</p>
              <span>A browser-native CAD and mesh platform crafted for engineering teams.</span>
            </div>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </footer>
      </div>
    </div>
  )
}

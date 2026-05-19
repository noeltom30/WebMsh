import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useTheme } from '../../hooks/useTheme'
import WebMshLogo from './WebMshLogo'
import './PublicNavbar.css'

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => (
        `landing-nav-link ${isActive ? 'active' : ''}`
      )}
    >
      {children}
    </NavLink>
  )
}

export default function PublicNavbar() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const onHomePage = location.pathname === '/'

  return (
    <header className="landing-header">
      <div className="landing-nav-shell">
        <Link to="/" className="landing-brand">
          <WebMshLogo size={38} color="#5aaddb" />
          <span className="landing-brand-name">WebMsh</span>
        </Link>

        <nav className="landing-nav-center">
          <NavItem to="/">Home</NavItem>
          {onHomePage && (
            <>
              <a href="#features" className="landing-nav-link">Features</a>
              <a href="#how-it-works" className="landing-nav-link">How It Works</a>
            </>
          )}
          {user && <NavItem to="/profile">Profile</NavItem>}
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            onClick={toggleTheme}
            className="cursor-target landing-theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          {user ? (
            <>
              <button onClick={() => navigate('/profile')} className="cursor-target landing-nav-btn landing-nav-btn-muted">Projects</button>
              <button onClick={() => navigate('/profile')} className="cursor-target landing-nav-btn landing-nav-btn-primary">Dashboard</button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/auth')} className="cursor-target landing-nav-btn landing-nav-btn-muted">Sign In</button>
              <button onClick={() => navigate('/auth')} className="cursor-target landing-nav-btn landing-nav-btn-primary">Get Started</button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

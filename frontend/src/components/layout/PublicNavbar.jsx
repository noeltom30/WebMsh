import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useTheme } from '../../hooks/useTheme'
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
  const onHomePage = location.pathname === '/'

  return (
    <header className="landing-header">
      <div className="landing-nav-shell">
        <Link to="/" className="landing-brand">WebMsh</Link>

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
            className="landing-theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          {user ? (
            <>
              <Link to="/profile" className="landing-nav-btn landing-nav-btn-muted">Projects</Link>
              <Link to="/profile" className="landing-nav-btn landing-nav-btn-primary">Dashboard</Link>
            </>
          ) : (
            <>
              <Link to="/auth" className="landing-nav-btn landing-nav-btn-muted">Sign In</Link>
              <Link to="/auth" className="landing-nav-btn landing-nav-btn-primary">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

import { Link, NavLink, useLocation } from 'react-router-dom'
import Button from '../ui/Button'
import { useAuth } from '../../context/useAuth'
import { useTheme } from '../../hooks/useTheme'

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => (
        `text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${isActive ? 'text-cyan-200' : 'text-slate-300 hover:text-white'}`
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
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" className="text-lg font-semibold tracking-wide text-slate-100">WebMsh</Link>

        <nav className="hidden items-center gap-8 md:flex">
          <NavItem to="/">Home</NavItem>
          {onHomePage && (
            <>
              <a href="#features" className="text-sm font-medium text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">How It Works</a>
            </>
          )}
          {user && <NavItem to="/profile">Profile</NavItem>}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="hidden h-11 rounded-xl border border-white/15 px-3 text-sm text-slate-200 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:inline-flex sm:items-center"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          {user ? (
            <>
              <Link to="/profile">
                <Button variant="ghost">View Projects</Button>
              </Link>
              <Link to="/profile">
                <Button>Dashboard</Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/auth">
                <Button>Get Started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

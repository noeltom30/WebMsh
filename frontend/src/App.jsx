import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Workspace from './Workspace'
import { useAuth } from './context/useAuth'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-sm">
        Initializing secure session...
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const location = useLocation()
  const { user, loading } = useAuth()

  if (loading) return <FullPageLoader />
  if (user) return children

  const params = new URLSearchParams()
  const returnTo = `${location.pathname}${location.search}`
  params.set('returnTo', returnTo)

  const authError = new URLSearchParams(location.search).get('auth_error')
  if (authError) params.set('auth_error', authError)

  return <Navigate to={`/signin?${params.toString()}`} replace />
}

function GuestOnlyRoute({ children }) {
  const location = useLocation()
  const { user, loading } = useAuth()

  if (loading) return <FullPageLoader />
  if (!user) return children

  const requestedReturn = new URLSearchParams(location.search).get('returnTo')
  const target = requestedReturn && requestedReturn.startsWith('/') ? requestedReturn : '/workspace'
  return <Navigate to={target} replace />
}

function WorkspaceRoute() {
  const { user, setUser, signOut } = useAuth()
  return (
    <Workspace
      user={user}
      onUserUpdate={setUser}
      onLogout={signOut}
    />
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/signin"
        element={(
          <GuestOnlyRoute>
            <SignInPage />
          </GuestOnlyRoute>
        )}
      />
      <Route
        path="/signup"
        element={(
          <GuestOnlyRoute>
            <SignUpPage />
          </GuestOnlyRoute>
        )}
      />
      <Route
        path="/profile"
        element={(
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/workspace"
        element={(
          <ProtectedRoute>
            <WorkspaceRoute />
          </ProtectedRoute>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

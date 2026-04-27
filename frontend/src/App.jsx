import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AuthPage from './AuthPage'
import Workspace from './Workspace'
import { useAuth } from './context/useAuth'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'

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
  const { user, loading } = useAuth()

  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function GuestOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <FullPageLoader />
  if (user) return <Navigate to="/profile" replace />
  return children
}

function RootRoute() {
  const { user, loading } = useAuth()

  if (loading) return <FullPageLoader />
  if (user) return <Navigate to="/profile" replace />
  return <HomePage />
}

function WorkspaceRoute() {
  const { projectId } = useParams()
  const { user, setUser, signOut } = useAuth()

  return (
    <Workspace
      projectId={projectId}
      user={user}
      onUserUpdate={setUser}
      onLogout={signOut}
    />
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route
        path="/auth"
        element={(
          <GuestOnlyRoute>
            <AuthPage />
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
        path="/workspace/:projectId"
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

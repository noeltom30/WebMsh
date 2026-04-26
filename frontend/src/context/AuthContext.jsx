import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { AuthContext } from './AuthContextValue'

function rememberLoginStamp(email) {
  if (!email) return
  const key = `webmsh_last_login_${email.toLowerCase()}`
  localStorage.setItem(key, new Date().toISOString())
}

function rememberJoinHint(userId) {
  if (!userId) return
  const key = `webmsh_joined_hint_${userId}`
  const existing = localStorage.getItem(key)
  if (!existing) localStorage.setItem(key, new Date().toISOString())
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const authed = await api.me()
    setUser(authed)
    rememberLoginStamp(authed?.email)
    rememberJoinHint(authed?.id)
    return authed
  }, [])

  useEffect(() => {
    refreshUser()
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [refreshUser])

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({
    user,
    setUser,
    loading,
    refreshUser,
    signOut,
  }), [user, loading, refreshUser, signOut])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

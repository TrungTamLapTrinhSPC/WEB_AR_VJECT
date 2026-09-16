import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getMe, login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/auth.js'
import { clearTokens, setTokens } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await getMe()
      setUser(me)
    } catch {
      clearTokens()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = async (email, password) => {
    await apiLogin(email, password)
    const me = await getMe()
    setUser(me)
    return me
  }

  const register = async (payload) => apiRegister(payload)

  const logout = async () => {
    await apiLogout()
    setUser(null)
  }

  const refreshUser = async () => {
    const me = await getMe()
    setUser(me)
    return me
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

import { apiFetch, setTokens, clearTokens, normalizeApiBase } from './client.js'

const publicPost = (path, body) =>
  apiFetch(path, { method: 'POST', body: JSON.stringify(body), skipAuth: true })

export async function login(email, password) {
  const data = await publicPost('/auth/login', { email, password })
  setTokens(data.access_token, data.refresh_token)
  return data
}

export async function register(payload) {
  return publicPost('/auth/register', payload)
}

export async function verifyEmail(email, code) {
  const data = await publicPost('/auth/verify-email', { email, code })
  setTokens(data.access_token, data.refresh_token)
  return data
}

export async function resendVerification(email) {
  return publicPost('/auth/resend-verification', { email })
}

export async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' })
  } finally {
    clearTokens()
  }
}

export async function getMe() {
  return apiFetch('/auth/me')
}

export async function fetchPasswordPolicy() {
  const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE)
  const res = await fetch(`${API_BASE}/auth/password-policy`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error('password policy')
  return data
}

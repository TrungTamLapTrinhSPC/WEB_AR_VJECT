import { apiFetch, setTokens, clearTokens } from './client.js'

export async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setTokens(data.access_token, data.refresh_token)
  return data
}

export async function register(payload) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setTokens(data.access_token, data.refresh_token)
  return data
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

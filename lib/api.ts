import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://aussie-accounting-main-maverick-500s-projects.vercel.app'

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('api_token')
}

async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('api_token', token)
}

async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync('api_token')
}

interface ApiOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_BASE}/api/v2${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401) {
    await clearToken()
    throw new Error('Session expired. Please sign in again.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `Request failed (${res.status})`)
  }

  return res.json()
}

export { api, getToken, setToken, clearToken, API_BASE }

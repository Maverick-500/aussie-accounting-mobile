import { create } from 'zustand'
import { api, setToken, clearToken, getToken } from './api'

interface AuthState {
  token: string | null
  orgId: string | null
  loading: boolean
  login: (email: string, password: string, orgId?: string) => Promise<{ requiresOrgSelection?: boolean; organizations?: { id: string; name: string }[] }>
  logout: () => Promise<void>
  restore: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  orgId: null,
  loading: true,

  login: async (email, password, orgId) => {
    const res = await api<any>('/auth/login', {
      method: 'POST',
      body: { email, password, orgId },
    })

    if (res.requiresOrgSelection) {
      return { requiresOrgSelection: true, organizations: res.organizations }
    }

    await setToken(res.token)
    set({ token: res.token, orgId: res.orgId })
    return {}
  },

  logout: async () => {
    await clearToken()
    set({ token: null, orgId: null })
  },

  restore: async () => {
    const token = await getToken()
    if (token) {
      set({ token, loading: false })
    } else {
      set({ loading: false })
    }
  },
}))

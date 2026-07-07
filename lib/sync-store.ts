import { create } from 'zustand'

interface SyncState {
  isOnline: boolean
  pendingCount: number
  lastSyncedAt: string | null
  syncing: boolean
  setOnline: (online: boolean) => void
  setPendingCount: (count: number) => void
  setLastSynced: (time: string) => void
  setSyncing: (syncing: boolean) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: true,
  pendingCount: 0,
  lastSyncedAt: null,
  syncing: false,
  setOnline: (online) => set({ isOnline: online }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setLastSynced: (time) => set({ lastSyncedAt: time }),
  setSyncing: (syncing) => set({ syncing: syncing }),
}))

import { useEffect, useRef } from 'react'
import { Stack } from 'expo-router'
import { useAuthStore } from '../lib/store'
import { router } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { getDb } from '@/lib/db'
import { onConnectivityChange, isOnline as checkOnline } from '@/lib/offline'
import { syncFromServer, syncPendingOrders, getPendingOrderCount } from '@/lib/sync'
import { useSyncStore } from '@/lib/sync-store'
import SyncIndicator from '@/components/SyncIndicator'

export default function RootLayout() {
  const { token, loading, restore } = useAuthStore()
  const { setOnline, setPendingCount, setLastSynced, setSyncing } = useSyncStore()
  const initialised = useRef(false)

  useEffect(() => {
    restore()
  }, [])

  useEffect(() => {
    if (!loading) {
      if (!token) {
        router.replace('/login')
      }
    }
  }, [loading, token])

  // Initialise SQLite, connectivity listener, and first sync
  useEffect(() => {
    if (initialised.current) return
    initialised.current = true

    let unsubscribe: (() => void) | null = null

    async function init() {
      const db = await getDb()

      // Refresh pending count on startup
      const count = await getPendingOrderCount(db)
      setPendingCount(count)

      // Run initial sync if online
      const online = await checkOnline()
      setOnline(online)
      if (online) {
        await runFullSync(db)
      }

      // Listen for connectivity changes
      unsubscribe = onConnectivityChange(async (connected) => {
        setOnline(connected)
        if (connected) {
          const freshDb = await getDb()
          await runFullSync(freshDb)
        }
      })
    }

    async function runFullSync(db: Awaited<ReturnType<typeof getDb>>) {
      try {
        setSyncing(true)

        // Push pending orders first
        await syncPendingOrders(db)

        // Pull latest data from server
        await syncFromServer(db)

        // Refresh counts
        const remaining = await getPendingOrderCount(db)
        setPendingCount(remaining)
        setLastSynced(new Date().toISOString())
      } catch {
        // Sync failures are non-fatal; we will retry on next
        // connectivity change or app restart.
      } finally {
        setSyncing(false)
      }
    }

    init()

    return () => {
      unsubscribe?.()
    }
  }, [setOnline, setPendingCount, setLastSynced, setSyncing])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <SyncIndicator />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="bank-transactions" options={{ headerShown: true, title: 'Bank Transactions' }} />
        <Stack.Screen name="contacts" options={{ headerShown: true, title: 'Contacts' }} />
        <Stack.Screen name="copilot" options={{ headerShown: true, title: 'AI Copilot' }} />
      </Stack>
    </View>
  )
}

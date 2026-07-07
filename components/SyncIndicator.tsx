import { useEffect, useRef, useState } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { useSyncStore } from '@/lib/sync-store'

/**
 * A thin status bar rendered at the top of the screen that
 * communicates offline state, pending order count, and sync
 * completion.
 *
 * Visibility rules:
 *  - Orange "Offline" when the device has no connection.
 *  - Orange "X orders pending" when there are queued orders.
 *  - Green "Synced" flash for 2 seconds after sync completes.
 *  - Hidden when online with nothing pending.
 */
export default function SyncIndicator() {
  const { isOnline, pendingCount, syncing } = useSyncStore()

  // Brief "Synced" flash
  const [showSynced, setShowSynced] = useState(false)
  const prevSyncing = useRef(syncing)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Detect the transition from syncing → not syncing while online
    if (prevSyncing.current && !syncing && isOnline) {
      setShowSynced(true)
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start()

      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowSynced(false))
      }, 2000)

      return () => clearTimeout(timer)
    }
    prevSyncing.current = syncing
  }, [syncing, isOnline, fadeAnim])

  // Nothing to show
  if (isOnline && pendingCount === 0 && !showSynced) return null

  // Determine label and colour
  let label = ''
  let bgColour = '#f97316' // orange

  if (!isOnline) {
    label = 'Offline'
  } else if (pendingCount > 0) {
    label = `${pendingCount} order${pendingCount === 1 ? '' : 's'} pending`
  } else if (showSynced) {
    label = 'Synced'
    bgColour = '#16a34a' // green
  }

  if (!label) return null

  const Wrapper = showSynced ? Animated.View : View
  const wrapperStyle = showSynced
    ? [styles.bar, { backgroundColor: bgColour, opacity: fadeAnim }]
    : [styles.bar, { backgroundColor: bgColour }]

  return (
    <Wrapper style={wrapperStyle}>
      <Text style={styles.label}>{label}</Text>
    </Wrapper>
  )
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
})

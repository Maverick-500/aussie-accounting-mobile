import NetInfo from '@react-native-community/netinfo'

/**
 * Subscribe to connectivity changes. Returns an unsubscribe function.
 */
export function onConnectivityChange(
  callback: (isConnected: boolean) => void,
): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    callback(state.isConnected ?? false)
  })
  return unsubscribe
}

/**
 * One-shot check: are we currently online?
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch()
  return state.isConnected ?? false
}

import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { useAuthStore } from '../lib/store'
import { router } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

export default function RootLayout() {
  const { token, loading, restore } = useAuthStore()

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  )
}

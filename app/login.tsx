import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native'
import { useAuthStore } from '../lib/store'
import { router } from 'expo-router'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore(s => s.login)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result.requiresOrgSelection) {
        // For now, pick the first organisation. Multi-org picker comes later.
        const firstOrg = result.organizations?.[0]
        if (firstOrg) {
          await login(email, password, firstOrg.id)
        }
      }
      router.replace('/(tabs)')
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }}>Apex Accounting</Text>
        <Text style={{ fontSize: 16, color: '#6b7280', marginBottom: 32 }}>Sign in to your account</Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 }}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 24, fontSize: 16 }}
        />

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={{ backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

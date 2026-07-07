import { View, Text, SafeAreaView } from 'react-native'

export default function MoreScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: '600' }}>More</Text>
      </View>
    </SafeAreaView>
  )
}

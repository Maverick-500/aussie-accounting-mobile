import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Stack } from 'expo-router'
import { Search } from 'lucide-react-native'
import { api } from '@/lib/api'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Contact {
  id: string
  name: string
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
  email?: string
}

/* Colour mapping for contact type badges */
const TYPE_COLOURS: Record<Contact['type'], { bg: string; text: string }> = {
  CUSTOMER: { bg: '#dbeafe', text: '#1d4ed8' },
  SUPPLIER: { bg: '#ffedd5', text: '#c2410c' },
  BOTH: { bg: '#ede9fe', text: '#7c3aed' },
}

/* ------------------------------------------------------------------ */
/* Contacts screen                                                     */
/* ------------------------------------------------------------------ */

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const fetchContacts = useCallback(async () => {
    try {
      setError(null)
      const res = await api<{ data: Contact[] }>('/contacts')
      setContacts(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts')
    }
  }, [])

  useEffect(() => {
    fetchContacts().finally(() => setLoading(false))
  }, [fetchContacts])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchContacts()
    setRefreshing(false)
  }, [fetchContacts])

  /* Local search filter */
  const filtered = useMemo(() => {
    if (!query.trim()) return contacts
    const q = query.toLowerCase()
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)),
    )
  }, [contacts, query])

  const renderItem = ({ item }: { item: Contact }) => {
    const colours = TYPE_COLOURS[item.type] ?? TYPE_COLOURS.CUSTOMER
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.badge, { backgroundColor: colours.bg }]}>
              <Text style={[styles.badgeText, { color: colours.text }]}>
                {item.type}
              </Text>
            </View>
          </View>
          {item.email ? (
            <Text style={styles.email} numberOfLines={1}>
              {item.email}
            </Text>
          ) : null}
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Contacts', headerShown: true }} />
        <View style={styles.centred}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Contacts', headerShown: true }} />
        <View style={styles.centred}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Contacts', headerShown: true }} />
      <View style={styles.container}>
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListEmptyComponent={
            <View style={styles.centred}>
              <Text style={styles.emptyText}>
                {query.trim() ? 'No contacts match your search.' : 'No contacts found.'}
              </Text>
            </View>
          }
        />
      </View>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  /* Search bar */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 15,
    color: '#111827',
  },

  /* Contact row */
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    flexShrink: 1,
  },
  email: {
    fontSize: 13,
    color: '#6b7280',
  },

  /* Type badge */
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Divider */
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginLeft: 16,
  },

  /* States */
  errorText: {
    fontSize: 15,
    color: '#dc2626',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
  },
})

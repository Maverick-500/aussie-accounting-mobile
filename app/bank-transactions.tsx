import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Stack } from 'expo-router'
import { api } from '@/lib/api'
import { formatAud } from '@/lib/format'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type?: string // CREDIT or DEBIT
}

/* ------------------------------------------------------------------ */
/* Bank Transactions screen                                            */
/* ------------------------------------------------------------------ */

export default function BankTransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    try {
      setError(null)
      const res = await api<{ data: Transaction[]; count: number }>(
        '/bank-transactions?limit=20',
      )
      setTransactions(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    }
  }, [])

  useEffect(() => {
    fetchTransactions().finally(() => setLoading(false))
  }, [fetchTransactions])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchTransactions()
    setRefreshing(false)
  }, [fetchTransactions])

  /* Format the date for display */
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const renderItem = ({ item }: { item: Transaction }) => {
    const isCredit = item.amount > 0
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.description} numberOfLines={1}>
            {item.description || 'No description'}
          </Text>
          <Text style={styles.date}>{formatDate(item.date)}</Text>
        </View>
        <Text style={[styles.amount, isCredit ? styles.credit : styles.debit]}>
          {isCredit ? '+' : ''}
          {formatAud(item.amount)}
        </Text>
      </View>
    )
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Bank Transactions', headerShown: true }} />
        <View style={styles.centred}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Bank Transactions', headerShown: true }} />
        <View style={styles.centred}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Bank Transactions', headerShown: true }} />
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListEmptyComponent={
          <View style={styles.centred}>
            <Text style={styles.emptyText}>No transactions found.</Text>
          </View>
        }
      />
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
  content: {
    flexGrow: 1,
  },
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  /* Transaction row */
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  description: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  date: {
    fontSize: 13,
    color: '#6b7280',
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
  },
  credit: {
    color: '#16a34a',
  },
  debit: {
    color: '#dc2626',
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

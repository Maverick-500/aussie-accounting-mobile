import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native'
import { api } from '@/lib/api'
import { formatAud } from '@/lib/format'

interface DashboardData {
  receivable: number
  payable: number
  overdueInvoices: number
  overdueBills: number
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null)
      const result = await api<DashboardData>('/dashboard')
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchDashboard().finally(() => setLoading(false))
  }, [fetchDashboard])

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchDashboard()
    setRefreshing(false)
  }, [fetchDashboard])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centred}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setLoading(true)
              fetchDashboard().finally(() => setLoading(false))
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <Text style={styles.heading}>Dashboard</Text>

        {/* Summary cards (2x2 grid) */}
        <View style={styles.grid}>
          <SummaryCard
            label="Receivable"
            value={formatAud(data?.receivable ?? 0)}
            colour="#2563eb"
          />
          <SummaryCard
            label="Payable"
            value={formatAud(data?.payable ?? 0)}
            colour="#ea580c"
          />
          <SummaryCard
            label="Overdue Invoices"
            value={String(data?.overdueInvoices ?? 0)}
            colour="#dc2626"
          />
          <SummaryCard
            label="Overdue Bills"
            value={String(data?.overdueBills ?? 0)}
            colour="#dc2626"
          />
        </View>

        {/* Recent activity placeholder */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Text style={styles.placeholderText}>
            Recent activity will appear here.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

/* ------------------------------------------------------------------ */
/* Summary card component                                              */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label,
  value,
  colour,
}: {
  label: string
  value: string
  colour: string
}) {
  return (
    <View style={[styles.card, { borderLeftColor: colour }]}>
      <Text style={[styles.cardValue, { color: colour }]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
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
    padding: 16,
  },
  scrollContent: {
    padding: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    color: '#111827',
  },

  /* 2x2 grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },

  /* Individual card */
  card: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    /* Shadow (iOS) */
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    /* Shadow (Android) */
    elevation: 2,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },

  /* Recent activity */
  activitySection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#9ca3af',
  },

  /* Error state */
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
})

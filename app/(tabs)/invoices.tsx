import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { api } from '@/lib/api'
import { formatAud } from '@/lib/format'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE'

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface Invoice {
  id: string
  invoiceNumber: string
  contactName?: string
  date: string
  dueDate?: string
  status: InvoiceStatus
  total: number
  amountPaid?: number
  amountDue?: number
  lineItems?: LineItem[]
}

interface InvoiceListResponse {
  data: Invoice[]
  count: number
  limit: number
  offset: number
}

/* ------------------------------------------------------------------ */
/* Status badge colour map                                             */
/* ------------------------------------------------------------------ */

const STATUS_COLOURS: Record<InvoiceStatus, { bg: string; text: string }> = {
  DRAFT: { bg: '#e5e7eb', text: '#374151' },
  SENT: { bg: '#dbeafe', text: '#1d4ed8' },
  PAID: { bg: '#dcfce7', text: '#15803d' },
  OVERDUE: { bg: '#fee2e2', text: '#b91c1c' },
}

/* ------------------------------------------------------------------ */
/* Filter chips                                                        */
/* ------------------------------------------------------------------ */

type FilterValue = 'ALL' | InvoiceStatus

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Paid', value: 'PAID' },
]

/* ------------------------------------------------------------------ */
/* Main screen                                                         */
/* ------------------------------------------------------------------ */

export default function InvoicesScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterValue>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [createModalVisible, setCreateModalVisible] = useState(false)

  /* Fetch invoices from the API */
  const fetchInvoices = useCallback(async () => {
    try {
      setError(null)
      const query = filter === 'ALL' ? '' : `&status=${filter}`
      const result = await api<InvoiceListResponse>(
        `/invoices?limit=50&offset=0${query}`,
      )
      setInvoices(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    fetchInvoices().finally(() => setLoading(false))
  }, [fetchInvoices])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchInvoices()
    setRefreshing(false)
  }, [fetchInvoices])

  /* Send an invoice via email or SMS */
  const handleSend = useCallback(
    (invoice: Invoice) => {
      Alert.alert('Send Invoice', 'How would you like to send this invoice?', [
        {
          text: 'Email',
          onPress: async () => {
            try {
              await api(`/invoices/${invoice.id}/send`, {
                method: 'POST',
                body: { method: 'email' },
              })
              Alert.alert('Sent', 'Invoice sent via email.')
              fetchInvoices()
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed to send',
              )
            }
          },
        },
        {
          text: 'SMS',
          onPress: async () => {
            try {
              await api(`/invoices/${invoice.id}/send`, {
                method: 'POST',
                body: { method: 'sms' },
              })
              Alert.alert('Sent', 'Invoice sent via SMS.')
              fetchInvoices()
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed to send',
              )
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ])
    },
    [fetchInvoices],
  )

  /* Mark invoice as paid (local-only for v1) */
  const handleMarkPaid = useCallback((invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, status: 'PAID' as InvoiceStatus, amountDue: 0 }
          : inv,
      ),
    )
  }, [])

  /* After creating an invoice, refresh the list */
  const handleInvoiceCreated = useCallback(() => {
    setCreateModalVisible(false)
    fetchInvoices()
  }, [fetchInvoices])

  /* ----- Loading state ----- */
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    )
  }

  /* ----- Error state ----- */
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centred}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setLoading(true)
              fetchInvoices().finally(() => setLoading(false))
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  /* ----- Main list ----- */
  return (
    <SafeAreaView style={styles.container}>
      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.value
          return (
            <Pressable
              key={f.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.centred}>
            <Text style={styles.emptyText}>No invoices found.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const expanded = expandedId === item.id
          return (
            <Pressable
              style={styles.row}
              onPress={() => setExpandedId(expanded ? null : item.id)}
            >
              {/* Summary row */}
              <View style={styles.rowHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceNumber}>
                    {item.invoiceNumber}
                  </Text>
                  {item.contactName ? (
                    <Text style={styles.contactName}>{item.contactName}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.total}>{formatAud(item.total)}</Text>
                  <StatusBadge status={item.status} />
                </View>
              </View>
              <Text style={styles.date}>{item.date}</Text>

              {/* Expanded detail */}
              {expanded && (
                <View style={styles.expandedSection}>
                  {item.dueDate ? (
                    <DetailRow label="Due date" value={item.dueDate} />
                  ) : null}
                  <DetailRow
                    label="Amount paid"
                    value={formatAud(item.amountPaid ?? 0)}
                  />
                  <DetailRow
                    label="Amount due"
                    value={formatAud(item.amountDue ?? item.total)}
                  />

                  {/* Line items */}
                  {item.lineItems && item.lineItems.length > 0 && (
                    <View style={styles.lineItemsSection}>
                      <Text style={styles.lineItemsHeading}>Line items</Text>
                      {item.lineItems.map((li, idx) => (
                        <View key={idx} style={styles.lineItemRow}>
                          <Text style={styles.lineItemDesc} numberOfLines={1}>
                            {li.description}
                          </Text>
                          <Text style={styles.lineItemAmount}>
                            {formatAud(li.total)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={styles.actionRow}>
                    {(item.status === 'DRAFT' || item.status === 'SENT') && (
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => handleSend(item)}
                      >
                        <Text style={styles.actionButtonText}>Send</Text>
                      </Pressable>
                    )}
                    {(item.status === 'SENT' || item.status === 'OVERDUE') && (
                      <Pressable
                        style={[styles.actionButton, styles.actionButtonGreen]}
                        onPress={() => handleMarkPaid(item.id)}
                      >
                        <Text style={styles.actionButtonText}>
                          Mark as Paid
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
            </Pressable>
          )
        }}
      />

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => setCreateModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {/* Create invoice modal */}
      <CreateInvoiceModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={handleInvoiceCreated}
      />
    </SafeAreaView>
  )
}

/* ------------------------------------------------------------------ */
/* Status badge                                                        */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const colours = STATUS_COLOURS[status] ?? STATUS_COLOURS.DRAFT
  return (
    <View style={[styles.badge, { backgroundColor: colours.bg }]}>
      <Text style={[styles.badgeText, { color: colours.text }]}>{status}</Text>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Detail row (label : value)                                          */
/* ------------------------------------------------------------------ */

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Create invoice modal                                                */
/* ------------------------------------------------------------------ */

function CreateInvoiceModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [contactName, setContactName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [includeGst, setIncludeGst] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setContactName('')
    setDescription('')
    setAmount('')
    setIncludeGst(true)
  }

  const handleCreate = async () => {
    const parsedAmount = parseFloat(amount)
    if (!description.trim()) {
      Alert.alert('Validation', 'Please enter a description.')
      return
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount.')
      return
    }

    setSubmitting(true)
    try {
      await api('/invoices', {
        method: 'POST',
        body: {
          contactName: contactName.trim() || undefined,
          description: description.trim(),
          amount: parsedAmount,
          includeGst: includeGst,
        },
      })
      resetForm()
      onCreated()
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to create invoice',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>New Invoice</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Form */}
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Contact name (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={contactName}
              onChangeText={setContactName}
              placeholder="e.g. Smith Enterprises"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Web development services"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.inputLabel}>Amount (AUD)</Text>
            <TextInput
              style={styles.textInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />

            <View style={styles.gstRow}>
              <Text style={styles.inputLabel}>Include GST</Text>
              <Switch
                value={includeGst}
                onValueChange={setIncludeGst}
                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                thumbColor={includeGst ? '#2563eb' : '#f4f3f4'}
              />
            </View>

            <Pressable
              style={[
                styles.createButton,
                submitting && styles.createButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create Invoice</Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
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

  /* Filter chips */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  chipActive: {
    backgroundColor: '#2563eb',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  chipTextActive: {
    color: '#ffffff',
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  /* Invoice row */
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  contactName: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  total: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },

  /* Status badge */
  badge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-end',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Expanded detail */
  expandedSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },

  /* Line items */
  lineItemsSection: {
    marginTop: 8,
  },
  lineItemsHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  lineItemDesc: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
    marginRight: 8,
  },
  lineItemAmount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },

  /* Action buttons */
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonGreen: {
    backgroundColor: '#15803d',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 30,
  },

  /* Empty state */
  emptyText: {
    fontSize: 15,
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

  /* Create invoice modal */
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalCancel: {
    fontSize: 16,
    color: '#2563eb',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  gstRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  createButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
})

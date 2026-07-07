import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { X, Plus, Minus, ShoppingCart, Check } from 'lucide-react-native'
import { api } from '@/lib/api'
import { formatAud } from '@/lib/format'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Product {
  id: string
  name: string
  sale_price: number
  category: string
  gst_treatment: string
}

interface CartItem {
  productId: string
  name: string
  price: number
  qty: number
  gstIncluded: boolean
}

type PaymentMethod = 'cash' | 'card'

type CheckoutPhase = 'idle' | 'payment' | 'success'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const GST_RATE = 10 // percent
const ALL_CATEGORIES = 'All'

/* ------------------------------------------------------------------ */
/* GST helpers                                                         */
/* ------------------------------------------------------------------ */

/** For a GST-inclusive item, the GST component = price / 11 */
function gstForItem(item: CartItem): number {
  if (!item.gstIncluded) return 0
  return (item.price * item.qty) / (1 + GST_RATE)
}

/* ------------------------------------------------------------------ */
/* Main screen                                                         */
/* ------------------------------------------------------------------ */

export default function POSScreen() {
  // Product data
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])

  // Checkout
  const [checkoutPhase, setCheckoutPhase] = useState<CheckoutPhase>('idle')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [amountTendered, setAmountTendered] = useState('')
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Responsive column count
  const screenWidth = Dimensions.get('window').width
  const numColumns = screenWidth > 768 ? 3 : 2

  /* ---------------------------------------------------------------- */
  /* Fetch products                                                    */
  /* ---------------------------------------------------------------- */

  const fetchProducts = useCallback(async () => {
    try {
      setError(null)
      const result = await api<{ data: Product[] }>('/products')
      setProducts(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    }
  }, [])

  useEffect(() => {
    fetchProducts().finally(() => setLoading(false))
  }, [fetchProducts])

  /* ---------------------------------------------------------------- */
  /* Derived: categories                                               */
  /* ---------------------------------------------------------------- */

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean))
    return [ALL_CATEGORIES, ...Array.from(cats).sort()]
  }, [products])

  /* ---------------------------------------------------------------- */
  /* Derived: filtered products                                        */
  /* ---------------------------------------------------------------- */

  const filteredProducts = useMemo(() => {
    let list = products
    if (selectedCategory !== ALL_CATEGORIES) {
      list = list.filter((p) => p.category === selectedCategory)
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(term))
    }
    return list
  }, [products, selectedCategory, search])

  /* ---------------------------------------------------------------- */
  /* Derived: cart totals                                               */
  /* ---------------------------------------------------------------- */

  const cartTotals = useMemo(() => {
    let subtotal = 0
    let gstAmount = 0
    for (const item of cart) {
      const lineTotal = item.price * item.qty
      subtotal += lineTotal
      gstAmount += gstForItem(item)
    }
    // Total equals subtotal because prices are already GST-inclusive
    // (GST is embedded, not added on top)
    return { subtotal, gstAmount, total: subtotal }
  }, [cart])

  const changeGiven = useMemo(() => {
    const tendered = parseFloat(amountTendered)
    if (isNaN(tendered) || tendered < cartTotals.total) return 0
    return tendered - cartTotals.total
  }, [amountTendered, cartTotals.total])

  /* ---------------------------------------------------------------- */
  /* Cart actions                                                      */
  /* ---------------------------------------------------------------- */

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id)
      if (existing) {
        return prev.map((c) =>
          c.productId === product.id ? { ...c, qty: c.qty + 1 } : c,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.sale_price,
          qty: 1,
          gstIncluded: product.gst_treatment === 'GST',
        },
      ]
    })
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((c) =>
          c.productId === productId ? { ...c, qty: c.qty + delta } : c,
        )
        .filter((c) => c.qty > 0)
    })
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((c) => c.productId !== productId))
  }

  function resetSale() {
    setCart([])
    setCheckoutPhase('idle')
    setPaymentMethod('card')
    setAmountTendered('')
    setOrderNumber(null)
  }

  /* ---------------------------------------------------------------- */
  /* Submit order                                                      */
  /* ---------------------------------------------------------------- */

  async function completeSale() {
    if (submitting) return
    setSubmitting(true)
    try {
      const items = cart.map((c) => ({
        productId: c.productId,
        name: c.name,
        price: c.price,
        qty: c.qty,
      }))
      const tendered =
        paymentMethod === 'cash' ? parseFloat(amountTendered) || 0 : undefined
      const result = await api<{ orderNumber: string }>('/orders', {
        method: 'POST',
        body: {
          items,
          subtotal: cartTotals.subtotal,
          gstAmount: cartTotals.gstAmount,
          total: cartTotals.total,
          paymentMethod,
          ...(paymentMethod === 'cash'
            ? { amountTendered: tendered, changeGiven }
            : {}),
        },
      })
      setOrderNumber(result.orderNumber)
      setCheckoutPhase('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed')
    } finally {
      setSubmitting(false)
    }
  }

  /* ---------------------------------------------------------------- */
  /* Loading / error states                                            */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    )
  }

  if (error && products.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centred}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setLoading(true)
              setError(null)
              fetchProducts().finally(() => setLoading(false))
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  /* ---------------------------------------------------------------- */
  /* Render helpers                                                    */
  /* ---------------------------------------------------------------- */

  const cartItemCount = cart.reduce((sum, c) => sum + c.qty, 0)

  const canCompleteSale =
    paymentMethod === 'card' ||
    (paymentMethod === 'cash' &&
      parseFloat(amountTendered) >= cartTotals.total)

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ---- Product grid section ---- */}
        <View style={styles.productsSection}>
          {/* Search bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipContainer}
          >
            {categories.map((cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.chip,
                  selectedCategory === cat && styles.chipActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedCategory === cat && styles.chipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Product grid */}
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            key={`grid-${numColumns}`}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            ListEmptyComponent={
              <View style={styles.centred}>
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.productCard}
                onPress={() => addToCart(item)}
              >
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.productPrice}>
                  {formatAud(item.sale_price)}
                </Text>
                {item.gst_treatment === 'GST' && (
                  <Text style={styles.gstLabel}>incl. GST</Text>
                )}
              </Pressable>
            )}
          />
        </View>

        {/* ---- Cart section ---- */}
        <View style={styles.cartSection}>
          {/* Cart header */}
          <View style={styles.cartHeader}>
            <ShoppingCart size={18} color="#111827" />
            <Text style={styles.cartTitle}>
              Cart{cartItemCount > 0 ? ` (${cartItemCount})` : ''}
            </Text>
          </View>

          {cart.length === 0 ? (
            <View style={styles.cartEmpty}>
              <Text style={styles.emptyText}>Tap a product to add it</Text>
            </View>
          ) : (
            <>
              {/* Cart items */}
              <ScrollView style={styles.cartList}>
                {cart.map((item) => (
                  <View key={item.productId} style={styles.cartRow}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.cartItemPrice}>
                        {formatAud(item.price)} ea.
                      </Text>
                    </View>
                    <View style={styles.cartQtyControls}>
                      <Pressable
                        style={styles.qtyButton}
                        onPress={() => updateQty(item.productId, -1)}
                        hitSlop={8}
                      >
                        <Minus size={16} color="#6b7280" />
                      </Pressable>
                      <Text style={styles.qtyText}>{item.qty}</Text>
                      <Pressable
                        style={styles.qtyButton}
                        onPress={() => updateQty(item.productId, 1)}
                        hitSlop={8}
                      >
                        <Plus size={16} color="#6b7280" />
                      </Pressable>
                    </View>
                    <Text style={styles.cartLineTotal}>
                      {formatAud(item.price * item.qty)}
                    </Text>
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => removeItem(item.productId)}
                      hitSlop={8}
                    >
                      <X size={16} color="#dc2626" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>

              {/* Totals */}
              <View style={styles.totalsContainer}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>
                    {formatAud(cartTotals.subtotal)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>GST (included)</Text>
                  <Text style={styles.totalValue}>
                    {formatAud(cartTotals.gstAmount)}
                  </Text>
                </View>
                <View style={[styles.totalRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>Total</Text>
                  <Text style={styles.grandTotalValue}>
                    {formatAud(cartTotals.total)}
                  </Text>
                </View>
              </View>

              {/* Charge button */}
              <Pressable
                style={styles.chargeButton}
                onPress={() => setCheckoutPhase('payment')}
              >
                <Text style={styles.chargeButtonText}>
                  Charge {formatAud(cartTotals.total)}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ---- Checkout modal ---- */}
      <Modal
        visible={checkoutPhase !== 'idle'}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (checkoutPhase === 'success') resetSale()
          else setCheckoutPhase('idle')
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {checkoutPhase === 'success' ? (
              /* ---------- Success screen ---------- */
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Check size={48} color="#16a34a" />
                </View>
                <Text style={styles.successTitle}>Sale Complete</Text>
                {orderNumber && (
                  <Text style={styles.orderNumber}>
                    Order #{orderNumber}
                  </Text>
                )}
                <Text style={styles.successTotal}>
                  {formatAud(cartTotals.total)}
                </Text>
                {paymentMethod === 'cash' && changeGiven > 0 && (
                  <Text style={styles.changeText}>
                    Change: {formatAud(changeGiven)}
                  </Text>
                )}
                <Pressable style={styles.newSaleButton} onPress={resetSale}>
                  <Text style={styles.newSaleButtonText}>New Sale</Text>
                </Pressable>
              </View>
            ) : (
              /* ---------- Payment screen ---------- */
              <View style={styles.paymentContainer}>
                {/* Close button */}
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setCheckoutPhase('idle')}
                  hitSlop={8}
                >
                  <X size={24} color="#6b7280" />
                </Pressable>

                <Text style={styles.paymentTotal}>
                  {formatAud(cartTotals.total)}
                </Text>
                <Text style={styles.paymentSubtitle}>Amount due</Text>

                {/* Payment method toggle */}
                <View style={styles.paymentToggle}>
                  <Pressable
                    style={[
                      styles.toggleOption,
                      paymentMethod === 'cash' && styles.toggleOptionActive,
                    ]}
                    onPress={() => setPaymentMethod('cash')}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        paymentMethod === 'cash' && styles.toggleTextActive,
                      ]}
                    >
                      Cash
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.toggleOption,
                      paymentMethod === 'card' && styles.toggleOptionActive,
                    ]}
                    onPress={() => setPaymentMethod('card')}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        paymentMethod === 'card' && styles.toggleTextActive,
                      ]}
                    >
                      Card
                    </Text>
                  </Pressable>
                </View>

                {/* Cash-specific fields */}
                {paymentMethod === 'cash' && (
                  <View style={styles.cashFields}>
                    <Text style={styles.fieldLabel}>Amount Tendered</Text>
                    <TextInput
                      style={styles.cashInput}
                      placeholder="0.00"
                      placeholderTextColor="#9ca3af"
                      keyboardType="decimal-pad"
                      value={amountTendered}
                      onChangeText={setAmountTendered}
                    />
                    {parseFloat(amountTendered) >= cartTotals.total && (
                      <View style={styles.changeRow}>
                        <Text style={styles.changeLabel}>Change</Text>
                        <Text style={styles.changeValue}>
                          {formatAud(changeGiven)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Error message */}
                {error && <Text style={styles.inlineError}>{error}</Text>}

                {/* Complete sale button */}
                <Pressable
                  style={[
                    styles.completeSaleButton,
                    (!canCompleteSale || submitting) &&
                      styles.completeSaleButtonDisabled,
                  ]}
                  onPress={completeSale}
                  disabled={!canCompleteSale || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.completeSaleButtonText}>
                      Complete Sale
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
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

  /* Search */
  searchContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },

  /* Category chips */
  chipScroll: {
    maxHeight: 48,
    paddingLeft: 12,
  },
  chipContainer: {
    alignItems: 'center',
    paddingRight: 12,
    gap: 8,
  },
  chip: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 34,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  chipTextActive: {
    color: '#ffffff',
  },

  /* Product grid */
  productsSection: {
    flex: 3,
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    minHeight: 88,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  gstLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },

  /* Cart section */
  cartSection: {
    flex: 2,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cartEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartList: {
    flex: 1,
    paddingHorizontal: 14,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  cartItemPrice: {
    fontSize: 12,
    color: '#6b7280',
  },
  cartQtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 8,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    minWidth: 24,
    textAlign: 'center',
  },
  cartLineTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    minWidth: 64,
    textAlign: 'right',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },

  /* Totals */
  totalsContainer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  grandTotalRow: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  /* Charge button */
  chargeButton: {
    backgroundColor: '#2563eb',
    marginHorizontal: 14,
    marginVertical: 10,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  chargeButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '88%',
    maxWidth: 420,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },

  /* Payment screen */
  paymentContainer: {
    alignItems: 'center',
  },
  paymentTotal: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  paymentSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  paymentToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    width: '100%',
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#111827',
  },
  cashFields: {
    width: '100%',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  cashInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  changeLabel: {
    fontSize: 15,
    color: '#374151',
  },
  changeValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16a34a',
  },
  inlineError: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  completeSaleButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  completeSaleButtonDisabled: {
    opacity: 0.5,
  },
  completeSaleButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },

  /* Success screen */
  successContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 12,
  },
  successTotal: {
    fontSize: 28,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 4,
  },
  changeText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
  },
  newSaleButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  newSaleButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
})

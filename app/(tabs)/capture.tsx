import { useState, useCallback } from 'react'
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { api, API_BASE } from '@/lib/api'
import { formatAud } from '@/lib/format'
import * as SecureStore from 'expo-secure-store'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ExtractedData {
  vendorName: string
  date: string
  totalAmount: number
  gstAmount: number
  lineItems: { description: string; amount: number }[]
}

interface UploadResponse {
  publicUrl: string
}

interface ExtractResponse {
  extracted: ExtractedData
}

interface BillResponse {
  data: { id: string; reference?: string }
}

type ScreenState = 'picker' | 'preview' | 'extracting' | 'review' | 'success'

/* ------------------------------------------------------------------ */
/* Main screen                                                         */
/* ------------------------------------------------------------------ */

export default function CaptureScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('picker')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [billRef, setBillRef] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /* Editable fields (initialised from extracted data) */
  const [vendorName, setVendorName] = useState('')
  const [date, setDate] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [gstAmount, setGstAmount] = useState('')

  /* ---- Image selection ---- */

  const pickImage = useCallback(
    async (source: 'camera' | 'gallery') => {
      /* Request camera permission if needed */
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'We need camera access so you can photograph receipts. Please enable it in your device settings.',
          )
          return
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: 'images' as ImagePicker.MediaType,
        quality: 0.8,
        base64: false,
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options)

      if (!result.canceled && result.assets?.[0]) {
        setImageUri(result.assets[0].uri)
        setScreenState('preview')
      }
    },
    [],
  )

  /* ---- Upload and extract ---- */

  const handleExtract = useCallback(async () => {
    if (!imageUri) return

    setScreenState('extracting')

    try {
      /* Step 1: Upload via multipart form.
         We bypass the JSON-only api() helper here because
         this endpoint expects multipart/form-data. */
      const token = await SecureStore.getItemAsync('api_token')

      const formData = new FormData()
      const filename = imageUri.split('/').pop() ?? 'receipt.jpg'
      const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'

      formData.append('receipt', {
        uri: imageUri,
        name: filename,
        type: mimeType,
      } as unknown as Blob)

      const uploadRes = await fetch(
        `${API_BASE}/api/v2/receipts/upload`,
        {
          method: 'POST',
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        },
      )

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: uploadRes.statusText }))
        throw new Error(err.error ?? `Upload failed (${uploadRes.status})`)
      }

      const { publicUrl } = (await uploadRes.json()) as UploadResponse

      /* Step 2: Extract data from the uploaded image */
      const extractRes = await api<ExtractResponse>('/receipts/extract', {
        method: 'POST',
        body: { imageUrl: publicUrl },
      })

      const data = extractRes.extracted

      /* Populate editable fields */
      setExtractedData(data)
      setVendorName(data.vendorName ?? '')
      setDate(data.date ?? '')
      setTotalAmount(String(data.totalAmount ?? ''))
      setGstAmount(String(data.gstAmount ?? ''))
      setScreenState('review')
    } catch (err) {
      Alert.alert(
        'Extraction Failed',
        err instanceof Error ? err.message : 'Could not process the receipt.',
      )
      setScreenState('preview')
    }
  }, [imageUri])

  /* ---- Save as draft bill ---- */

  const handleSaveBill = useCallback(async () => {
    const parsedTotal = parseFloat(totalAmount)
    const parsedGst = parseFloat(gstAmount)

    if (!vendorName.trim()) {
      Alert.alert('Validation', 'Please enter a vendor name.')
      return
    }
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      Alert.alert('Validation', 'Please enter a valid total amount.')
      return
    }

    setSaving(true)
    try {
      const res = await api<BillResponse>('/bills', {
        method: 'POST',
        body: {
          vendorName: vendorName.trim(),
          date: date.trim() || undefined,
          totalAmount: parsedTotal,
          gstAmount: isNaN(parsedGst) ? 0 : parsedGst,
          lineItems: extractedData?.lineItems ?? [],
        },
      })
      setBillRef(res.data?.reference ?? res.data?.id ?? 'Unknown')
      setScreenState('success')
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to save bill.',
      )
    } finally {
      setSaving(false)
    }
  }, [vendorName, date, totalAmount, gstAmount, extractedData])

  /* ---- Discard / reset ---- */

  const resetScreen = useCallback(() => {
    setImageUri(null)
    setExtractedData(null)
    setBillRef(null)
    setVendorName('')
    setDate('')
    setTotalAmount('')
    setGstAmount('')
    setSaving(false)
    setScreenState('picker')
  }, [])

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  /* --- Picker state --- */
  if (screenState === 'picker') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.pickerContainer}>
          <Text style={styles.heading}>Capture Receipt</Text>
          <Text style={styles.subtext}>
            Take a photo or choose from your gallery to extract receipt data
            automatically.
          </Text>

          <Pressable
            style={styles.pickerButton}
            onPress={() => pickImage('camera')}
          >
            <Text style={styles.pickerButtonText}>Take Photo</Text>
          </Pressable>

          <Pressable
            style={[styles.pickerButton, styles.pickerButtonSecondary]}
            onPress={() => pickImage('gallery')}
          >
            <Text style={styles.pickerButtonTextSecondary}>
              Choose from Gallery
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  /* --- Preview state --- */
  if (screenState === 'preview') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.heading}>Preview</Text>

          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.imagePreview}
              resizeMode="contain"
            />
          )}

          <Pressable style={styles.primaryButton} onPress={handleExtract}>
            <Text style={styles.primaryButtonText}>Extract Data</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={resetScreen}
          >
            <Text style={styles.secondaryButtonText}>Discard</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    )
  }

  /* --- Extracting state --- */
  if (screenState === 'extracting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.extractingText}>
            Analysing receipt...
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  /* --- Success state --- */
  if (screenState === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centred}>
          <Text style={styles.successIcon}>&#10003;</Text>
          <Text style={styles.successHeading}>Bill saved!</Text>
          <Text style={styles.successRef}>Reference: {billRef}</Text>

          <Pressable style={styles.primaryButton} onPress={resetScreen}>
            <Text style={styles.primaryButtonText}>Capture Another</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  /* --- Review state (editable form) --- */
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Review Extracted Data</Text>

        <Text style={styles.inputLabel}>Vendor name</Text>
        <TextInput
          style={styles.textInput}
          value={vendorName}
          onChangeText={setVendorName}
          placeholder="e.g. Officeworks"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.inputLabel}>Date (ISO format)</Text>
        <TextInput
          style={styles.textInput}
          value={date}
          onChangeText={setDate}
          placeholder="2026-07-05"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.inputLabel}>Total amount (AUD)</Text>
        <TextInput
          style={styles.textInput}
          value={totalAmount}
          onChangeText={setTotalAmount}
          placeholder="0.00"
          placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad"
        />

        <Text style={styles.inputLabel}>GST amount (AUD)</Text>
        <TextInput
          style={styles.textInput}
          value={gstAmount}
          onChangeText={setGstAmount}
          placeholder="0.00"
          placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad"
        />

        {/* Read-only line items */}
        {extractedData?.lineItems && extractedData.lineItems.length > 0 && (
          <View style={styles.lineItemsSection}>
            <Text style={styles.lineItemsHeading}>Line items</Text>
            {extractedData.lineItems.map((li, idx) => (
              <View key={idx} style={styles.lineItemRow}>
                <Text style={styles.lineItemDesc} numberOfLines={1}>
                  {li.description}
                </Text>
                <Text style={styles.lineItemAmount}>
                  {formatAud(li.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <Pressable
          style={[
            styles.primaryButton,
            saving && styles.primaryButtonDisabled,
          ]}
          onPress={handleSaveBill}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Save as Draft Bill</Text>
          )}
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={resetScreen}>
          <Text style={styles.secondaryButtonText}>Discard</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  /* Headings */
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 20,
  },

  /* Picker buttons (large touch targets) */
  pickerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  pickerButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 14,
    height: 60,
    justifyContent: 'center',
  },
  pickerButtonSecondary: {
    backgroundColor: '#f3f4f6',
  },
  pickerButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 17,
  },
  pickerButtonTextSecondary: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 17,
  },

  /* Image preview */
  imagePreview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },

  /* Buttons */
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },

  /* Extracting state */
  extractingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },

  /* Form fields */
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
    marginTop: 14,
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

  /* Line items */
  lineItemsSection: {
    marginTop: 18,
  },
  lineItemsHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  lineItemDesc: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
    marginRight: 8,
  },
  lineItemAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },

  /* Success state */
  successIcon: {
    fontSize: 48,
    color: '#15803d',
    marginBottom: 12,
  },
  successHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  successRef: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
  },
})

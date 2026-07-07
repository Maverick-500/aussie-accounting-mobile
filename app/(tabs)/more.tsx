import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import {
  Landmark,
  Users,
  Bot,
  TrendingUp,
  Scale,
  Wallet,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react-native'
import { useAuthStore } from '@/lib/store'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface MenuItem {
  label: string
  icon: React.ReactNode
  onPress?: () => void
  disabled?: boolean
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

/* ------------------------------------------------------------------ */
/* More screen                                                         */
/* ------------------------------------------------------------------ */

export default function MoreScreen() {
  const { logout } = useAuthStore()

  const handleSignOut = async () => {
    await logout()
    router.replace('/login')
  }

  const sections: MenuSection[] = [
    {
      title: 'Bookkeeping',
      items: [
        {
          label: 'Bank Transactions',
          icon: <Landmark size={22} color="#2563eb" />,
          onPress: () => router.push('/bank-transactions'),
        },
        {
          label: 'Contacts',
          icon: <Users size={22} color="#2563eb" />,
          onPress: () => router.push('/contacts'),
        },
        {
          label: 'AI Copilot',
          icon: <Bot size={22} color="#2563eb" />,
          onPress: () => router.push('/copilot'),
        },
      ],
    },
    {
      title: 'Reports',
      items: [
        {
          label: 'Profit & Loss',
          icon: <TrendingUp size={22} color="#9ca3af" />,
          disabled: true,
        },
        {
          label: 'Balance Sheet',
          icon: <Scale size={22} color="#9ca3af" />,
          disabled: true,
        },
        {
          label: 'Cash Flow',
          icon: <Wallet size={22} color="#9ca3af" />,
          disabled: true,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          label: 'Settings',
          icon: <Settings size={22} color="#9ca3af" />,
          disabled: true,
        },
        {
          label: 'Sign Out',
          icon: <LogOut size={22} color="#dc2626" />,
          onPress: handleSignOut,
        },
      ],
    },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.card}>
            {section.items.map((item, idx) => (
              <View key={item.label}>
                {idx > 0 && <View style={styles.divider} />}
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    pressed && !item.disabled && styles.rowPressed,
                  ]}
                  onPress={item.disabled ? undefined : item.onPress}
                  disabled={item.disabled}
                >
                  <View style={styles.rowLeft}>
                    {item.icon}
                    <Text
                      style={[
                        styles.rowLabel,
                        item.disabled && styles.rowLabelDisabled,
                        item.label === 'Sign Out' && styles.rowLabelDanger,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                  {item.disabled ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Coming soon</Text>
                    </View>
                  ) : (
                    <ChevronRight size={18} color="#9ca3af" />
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },

  /* Section */
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },

  /* Card wrapper */
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    /* Shadow (iOS) */
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    /* Shadow (Android) */
    elevation: 1,
  },

  /* Row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: '#f9fafb',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  rowLabelDisabled: {
    color: '#9ca3af',
  },
  rowLabelDanger: {
    color: '#dc2626',
  },

  /* Divider */
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginLeft: 50,
  },

  /* Coming-soon badge */
  badge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9ca3af',
  },
})

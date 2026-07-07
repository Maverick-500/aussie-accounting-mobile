import { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { Stack } from 'expo-router'
import { Send } from 'lucide-react-native'
import { api } from '@/lib/api'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
}

/* ------------------------------------------------------------------ */
/* AI Copilot screen                                                   */
/* ------------------------------------------------------------------ */

const SYSTEM_MESSAGE: Message = {
  id: 'system-0',
  role: 'system',
  text: 'Ask me anything about your accounts, GST, invoices, or payroll.',
}

export default function CopilotScreen() {
  const [messages, setMessages] = useState<Message[]>([SYSTEM_MESSAGE])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const listRef = useRef<FlatList<Message>>(null)

  const sendMessage = async () => {
    const question = input.trim()
    if (!question || thinking) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: question,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setThinking(true)

    // Scroll to end after adding user message
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)

    try {
      const res = await api<{ answer: string; model: string; tokens: number }>(
        '/copilot',
        {
          method: 'POST',
          body: { question },
        },
      )

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: res.answer,
      }

      setMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text:
          err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.',
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setThinking(false)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }

  const renderItem = ({ item }: { item: Message }) => {
    if (item.role === 'system') {
      return (
        <View style={styles.systemBubble}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      )
    }

    const isUser = item.role === 'user'
    return (
      <View
        style={[
          styles.bubbleRow,
          isUser ? styles.bubbleRowRight : styles.bubbleRowLeft,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.aiBubble,
          ]}
        >
          <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
            {item.text}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'AI Copilot', headerShown: true }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Messages list */}
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          ListFooterComponent={
            thinking ? (
              <View style={[styles.bubbleRow, styles.bubbleRowLeft]}>
                <View style={[styles.bubble, styles.aiBubble]}>
                  <Text style={styles.thinkingText}>Thinking...</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question..."
            placeholderTextColor="#9ca3af"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            editable={!thinking}
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <Pressable
            style={[
              styles.sendButton,
              (!input.trim() || thinking) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!input.trim() || thinking}
          >
            <Send size={20} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
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

  /* Messages list */
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },

  /* System message */
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    maxWidth: '90%',
  },
  systemText: {
    fontSize: 14,
    color: '#3730a3',
    textAlign: 'center',
    fontWeight: '500',
  },

  /* Bubble rows */
  bubbleRow: {
    marginBottom: 10,
  },
  bubbleRowLeft: {
    alignItems: 'flex-start',
  },
  bubbleRowRight: {
    alignItems: 'flex-end',
  },

  /* Bubbles */
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    /* Shadow */
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  userBubbleText: {
    color: '#ffffff',
  },
  thinkingText: {
    fontSize: 15,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  /* Input bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: '#111827',
    marginRight: 8,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
})

import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { sendPrompt } from '@/lib/gateway'
import { $gatewayState, $isStreaming, $messages } from '@/store/app'

export function useChat(sessionId: string | null) {
  const messages = useStore($messages)
  const isStreaming = useStore($isStreaming)
  const gatewayState = useStore($gatewayState)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  const send = useCallback(async () => {
    const text = input.trim()

    if (!text || sending || isStreaming) {return}

    if (gatewayState !== 'open') {throw new Error('gateway not connected')}
    setSending(true)
    // optimistic user message
    const { $messages: $m } = await import('@/store/app')
    $m.set([...$m.get(), { id: `${Date.now()}`, role: 'user', content: text }])
    setInput('')

    try {
      await sendPrompt(sessionId, text)
    } catch (e) {
      $m.set([...$m.get(), { id: `${Date.now()}`, role: 'assistant', content: `发送失败：${e instanceof Error ? e.message : String(e)}`, error: 'send_failed' }])
    } finally {
      setSending(false)
    }
  }, [input, sending, isStreaming, gatewayState, sessionId])

  return { messages, isStreaming, gatewayState, input, setInput, sending, send, bottomRef }
}

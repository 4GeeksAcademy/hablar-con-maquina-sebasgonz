'use client'

import {
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  FileText,
  Hash,
  Layers3,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'

type ChatMessage = { role: 'assistant' | 'user'; text: string }
type StoredChat = { messages: ChatMessage[]; inputTokens: number; outputTokens: number }

const storageKey = 'nova-chat-state'

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  return (message.role === 'assistant' || message.role === 'user') && typeof message.text === 'string'
}

const formatTokens = (value: number) => new Intl.NumberFormat('es-ES').format(value)

const history = [
  { title: 'Optimización de tokens', time: 'Ahora', active: true },
  { title: 'Ideas para newsletter', time: 'Ayer' },
  { title: 'Plan de lanzamiento', time: '12 oct' },
  { title: 'Resumen de investigación', time: '10 oct' },
]

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [mobileHistory, setMobileHistory] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inputTokens, setInputTokens] = useState(0)
  const [outputTokens, setOutputTokens] = useState(0)
  const [responseModel, setResponseModel] = useState('')
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const stored = JSON.parse(saved) as Partial<StoredChat>
        if (Array.isArray(stored.messages)) setMessages(stored.messages.filter(isChatMessage))
        if (typeof stored.inputTokens === 'number' && Number.isFinite(stored.inputTokens)) setInputTokens(stored.inputTokens)
        if (typeof stored.outputTokens === 'number' && Number.isFinite(stored.outputTokens)) setOutputTokens(stored.outputTokens)
      }
    } catch {
      localStorage.removeItem(storageKey)
    }
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    if (messages.length === 0 && inputTokens === 0 && outputTokens === 0) {
      localStorage.removeItem(storageKey)
      return
    }
    const stored: StoredChat = { messages, inputTokens, outputTokens }
    localStorage.setItem(storageKey, JSON.stringify(stored))
  }, [isHydrated, messages, inputTokens, outputTokens])

  const totalTokens = inputTokens + outputTokens
  const usagePercent = Math.min(100, Math.round((totalTokens / 50000) * 100))
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const conversation = [...messages, { role: 'user' as const, text }]
    setMessages(conversation)
    setInput('')
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation.map(({ role, text: content }) => ({ role, content })) }),
      })
      const result: {
        message?: string
        error?: string
        usage?: { promptTokens?: number; completionTokens?: number }
        model?: string
        responseTimeMs?: number
      } = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error ?? `La solicitud falló (HTTP ${response.status}). Inténtalo de nuevo.`)
      }
      if (!result.message?.trim()) throw new Error('Groq devolvió una respuesta vacía. Inténtalo de nuevo.')

      setMessages([...conversation, { role: 'assistant', text: result.message }])
      setInputTokens((total) => total + (result.usage?.promptTokens ?? 0))
      setOutputTokens((total) => total + (result.usage?.completionTokens ?? 0))
      setResponseModel(result.model ?? '')
      setResponseTimeMs(result.responseTimeMs ?? null)
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'
          : requestError instanceof Error
            ? requestError.message
            : 'Ocurrió un error al conectar con Groq.',
      )
    } finally {
      setLoading(false)
    }
  }

  const clearConversation = () => {
    setMessages([])
    setInput('')
    setInputTokens(0)
    setOutputTokens(0)
    setResponseModel('')
    setResponseTimeMs(null)
    setError('')
    setMobileHistory(false)
    localStorage.removeItem(storageKey)
  }

  const copyText = async (text: string) => {
    await navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="app-shell">
      <aside className={`history-panel ${mobileHistory ? 'history-panel-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={16} /></div>
          <span>nova<span className="brand-dot">.</span></span>
          <button className="icon-button mobile-close" aria-label="Cerrar historial" onClick={() => setMobileHistory(false)}><X size={17} /></button>
        </div>
        <button className="new-chat-button" onClick={clearConversation} disabled={loading}><Trash2 size={16} /> Borrar conversación</button>
        <div className="history-heading"><span>Historial</span><button className="quiet-button" aria-label="Más opciones"><MoreHorizontal size={16} /></button></div>
        <nav className="history-list" aria-label="Conversaciones recientes">
          {history.map((item) => (
            <button className={`history-item ${item.active ? 'history-item-active' : ''}`} key={item.title}>
              <MessageSquare size={15} />
              <span className="history-copy"><span>{item.title}</span><small>{item.time}</small></span>
            </button>
          ))}
        </nav>
        <div className="history-footer">
          <div className="plan-card">
            <div className="plan-card-top"><span className="plan-label">Plan personal</span><span className="plan-status">Activo</span></div>
            <div className="plan-usage"><span>Tokens mensuales</span><strong>{usagePercent}%</strong></div>
            <div className="usage-track"><span style={{ width: `${usagePercent}%` }} /></div>
            <span className="plan-caption">{formatTokens(totalTokens)} de 50.000 tokens usados</span>
          </div>
          <button className="profile-button"><span className="avatar avatar-small">MG</span><span className="profile-copy"><strong>María García</strong><small>Cuenta personal</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <button className="icon-button menu-button" aria-label="Abrir historial" onClick={() => setMobileHistory(true)}><Menu size={19} /></button>
          <div className="conversation-title"><div className="status-dot" /><div><strong>Optimización de tokens</strong><span>Qwen 3.8 27B · Llama Guard 86M</span></div></div>
          <div className="header-actions"><button className="icon-button" aria-label="Archivos"><FileText size={17} /></button><button className="icon-button" aria-label="Más opciones"><MoreHorizontal size={18} /></button></div>
        </header>

        <div className="chat-content">
          <div className="message-list">
            {messages.map((message, index) => {
              const { role, text } = message
              return <article className={`message-row ${role === 'user' ? 'message-row-user' : ''}`} key={`${role}-${index}`}>
                <div className={`avatar ${role === 'user' ? 'avatar-user' : 'avatar-ai'}`}>{role === 'user' ? <UserRound size={15} /> : <Sparkles size={15} />}</div>
                <div className="message-body"><div className="message-meta"><strong>{role === 'user' ? 'Tú' : 'Nova'}</strong><span>{role === 'user' ? '10:42' : '10:43'}</span></div><div className="message-text">{text}</div>{role !== 'user' && <button className="copy-button" onClick={() => copyText(text)}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar'}</button>}</div>
              </article>
            })}
            {loading && <article className="message-row"><div className="avatar avatar-ai"><Sparkles size={15} /></div><div className="message-body"><div className="message-meta"><strong>Nova</strong><span>escribiendo…</span></div><div className="typing-indicator"><i /><i /><i /></div></div></article>}
          </div>
          <div className="composer-wrap"><form className="composer" onSubmit={handleSubmit}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder="Escribe un mensaje…" rows={1} aria-label="Mensaje para Nova" disabled={loading} /><div className="composer-bottom"><span><Hash size={13} /> Shift + Enter para nueva línea</span><button className="send-button" type="submit" aria-label="Enviar mensaje" disabled={!input.trim() || loading}><ArrowUp size={17} /></button></div></form>{error && <p role="alert" style={{ color: '#b04732', fontSize: 12, margin: '8px 0' }}>{error}</p>}<p className="composer-note">Nova puede cometer errores. Revisa las respuestas importantes.</p></div>
        </div>
      </section>

      <aside className="stats-panel">
        <div className="stats-header"><span>Uso y rendimiento</span><button className="quiet-button" aria-label="Más estadísticas"><MoreHorizontal size={16} /></button></div>
        <div className="stats-period"><span>Este mes</span><ChevronDown size={14} /></div>
        <div className="token-summary"><div className="summary-ring" style={{ background: `conic-gradient(#d26c4a 0 ${usagePercent}%, #ddd9d1 ${usagePercent}% 100%)` }}><span>{usagePercent}<small>%</small></span></div><div><strong>{formatTokens(totalTokens)}</strong><span>tokens consumidos</span></div></div>
        <div className="stat-grid"><div className="stat-card"><span className="stat-icon purple"><Layers3 size={15} /></span><strong>{formatTokens(inputTokens)}</strong><span>Entrada</span></div><div className="stat-card"><span className="stat-icon orange"><BarChart3 size={15} /></span><strong>{formatTokens(outputTokens)}</strong><span>Salida</span></div></div>
        <div className="stats-section"><div className="section-label"><span>Actividad diaria</span><span>Últimos 7 días</span></div><div className="mini-chart"><div className="chart-lines"><span /><span /><span /><span /></div><div className="chart-bars"><i style={{ height: '34%' }} /><i style={{ height: '52%' }} /><i style={{ height: '43%' }} /><i style={{ height: '76%' }} /><i style={{ height: '58%' }} /><i className="bar-active" style={{ height: '92%' }} /><i style={{ height: '65%' }} /></div></div><div className="chart-labels"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div></div>
        <div className="stats-section"><div className="section-label"><span>Detalles de sesión</span></div><div className="detail-row"><span><MessageSquare size={14} /> Mensajes</span><strong>{messages.length}</strong></div><div className="detail-row"><span><Clock3 size={14} /> Última respuesta</span><strong>{responseTimeMs === null ? '—' : `${formatTokens(responseTimeMs)} ms`}</strong></div><div className="detail-row"><span><Sparkles size={14} /> Modelo usado</span><strong>{responseModel || '—'}</strong></div><div className="detail-row"><span><BarChart3 size={14} /> Coste estimado</span><strong>$0.03</strong></div></div>
        <div className="tip-card"><div className="tip-icon"><Sparkles size={15} /></div><div><strong>Consejo de Nova</strong><p>Los prompts claros y específicos suelen consumir menos tokens.</p></div></div>
      </aside>
    </main>
  )
}

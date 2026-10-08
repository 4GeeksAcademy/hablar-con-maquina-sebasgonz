export const maxDuration = 30

export async function POST(req: Request) {
  const startedAt = performance.now()
  const apiKey = process.env.GROQ_API_KEY ?? process.env.NEXT_PUBLIC_GROQ_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Falta configurar la clave de Groq en el servidor.' }, { status: 500 })
  }

  const { messages }: { messages: { role: 'user' | 'assistant'; content: string }[] } = await req.json()
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  const guardResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-prompt-guard-2-86m',
      messages: [{ role: 'user', content: lastUserMessage?.content ?? '' }],
      max_completion_tokens: 16,
      temperature: 0,
      top_p: 1,
      stream: false,
    }),
  })
  const guardResult = await guardResponse.json()

  if (!guardResponse.ok) {
    return Response.json({ error: guardResult.error?.message ?? 'No se pudo verificar el mensaje.' }, { status: guardResponse.status })
  }

  const guardScore = Number(guardResult.choices?.[0]?.message?.content?.trim())
  if (!Number.isFinite(guardScore)) {
    return Response.json({ error: 'El filtro de seguridad devolvió una respuesta no válida.' }, { status: 502 })
  }

  if (guardScore >= 0.5) {
    return Response.json({
      message: 'No puedo procesar ese mensaje porque fue marcado como una posible inyección de instrucciones.',
      usage: { promptTokens: guardResult.usage?.prompt_tokens ?? 0, completionTokens: 0 },
      model: guardResult.model ?? 'meta-llama/llama-prompt-guard-2-86m',
      responseTimeMs: Math.round(performance.now() - startedAt),
    })
  }

  const completionMessages = [
    {
      role: 'system' as const,
      content: 'Eres Nova, un asistente de IA conciso, amable y útil. Responde en español salvo que el usuario pida otro idioma. Usa Markdown sencillo cuando ayude a la claridad.',
    },
    ...messages,
  ]
  const requestCompletion = (model: string) => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: completionMessages,
      temperature: 0.6,
      max_completion_tokens: 2048,
      top_p: 0.95,
      stream: false,
      reasoning_effort: 'default',
      stop: null,
    }),
  })

  let selectedModel = 'qwen/qwen3.6-27b'
  let response = await requestCompletion(selectedModel)
  let result = await response.json()

  if (response.status === 404 && result.error?.code === 'model_not_found') {
    selectedModel = 'qwen/qwen3.8-27b'
    response = await requestCompletion(selectedModel)
    result = await response.json()
  }

  if (!response.ok) {
    return Response.json({ error: result.error?.message ?? 'Groq no pudo completar la solicitud.' }, { status: response.status })
  }

  return Response.json({
    message: result.choices?.[0]?.message?.content ?? '',
    usage: {
      promptTokens: (guardResult.usage?.prompt_tokens ?? 0) + (result.usage?.prompt_tokens ?? 0),
      completionTokens: result.usage?.completion_tokens ?? 0,
    },
    model: result.model ?? selectedModel,
    responseTimeMs: Math.round(performance.now() - startedAt),
  })
}
      

import { useCallback, useEffect, useRef, useState } from 'react'

interface RecognitionAlternative {
  transcript: string
}
interface RecognitionResult {
  isFinal: boolean
  0: RecognitionAlternative
  length: number
}
interface RecognitionEvent extends Event {
  resultIndex: number
  results: { length: number; [index: number]: RecognitionResult }
}
interface RecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

export function useVoiceSearch(onFinal: (text: string) => void) {
  const [supported] = useState(() => Boolean(getCtor()))
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef('')
  const callbackRef = useRef(onFinal)
  callbackRef.current = onFinal

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) {
      setError('unsupported')
      return false
    }
    setError(null)
    setInterim('')
    finalRef.current = ''
    recognitionRef.current?.abort()

    const recognition = new Ctor()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)
    recognition.onresult = (event) => {
      let finalText = ''
      let partial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) finalText += transcript
        else partial += transcript
      }
      if (finalText) {
        finalRef.current = `${finalRef.current} ${finalText}`.trim()
        setInterim(finalRef.current)
      } else {
        setInterim(partial)
      }
    }
    recognition.onerror = (event) => {
      setListening(false)
      const map: Record<string, string> = {
        'not-allowed': 'Permissão do microfone negada. Use o ditado do teclado.',
        'service-not-allowed': 'O microfone não está disponível neste WebView. Use o ditado do teclado.',
        'no-speech': 'Não ouvi nada. Tente de novo.',
        'audio-capture': 'Nenhum microfone encontrado.',
        network: 'Sem conexão para reconhecer a voz.',
      }
      setError(map[event.error] ?? 'Não foi possível ouvir. Tente de novo.')
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
      const text = finalRef.current.trim()
      if (text) callbackRef.current(text)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      return true
    } catch {
      setError('Não foi possível iniciar o microfone.')
      setListening(false)
      return false
    }
  }, [])

  return { supported, listening, interim, error, start, stop, clearError: () => setError(null) }
}

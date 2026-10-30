import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CloseIcon } from './Icons'
import { t } from '../lib/i18n'

export interface ToastMessage {
  id: number
  text: string
  tone?: 'default' | 'accent'
}

export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss
  const toastId = toast?.id

  useEffect(() => {
    if (!toastId) {
      setVisible(false)
      return
    }
    setVisible(true)
    const hide = setTimeout(() => setVisible(false), 3000)
    const clear = setTimeout(() => dismissRef.current(), 3300)
    return () => {
      clearTimeout(hide)
      clearTimeout(clear)
    }
  }, [toastId])

  if (!toast) return null
  return (
    <div
      className={`toast ${visible ? 'is-visible' : ''} ${toast.tone === 'accent' ? 'toast--accent' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast__icon">
        <CheckIcon size={15} />
      </span>
      <span>{toast.text}</span>
      <button
        className="toast__close"
        onClick={() => {
          setVisible(false)
          dismissRef.current()
        }}
        aria-label={t('Fechar aviso')}
      >
        <CloseIcon size={13} />
      </button>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'

interface DraftData {
  savedAt: number
  title: string
  slug: string
  excerpt: string
  content: string
  coverImage: string
  categoryIds: number[]
  tagIds: number[]
}

interface UseDraftAutosaveOptions {
  key: string
  data: DraftData
  enabled?: boolean
  onSave?: () => void
}

interface UseDraftAutosaveReturn {
  hasDraft: boolean
  draftData: DraftData | null
  restoreDraft: () => void
  discardDraft: () => void
  autosaveStatus: 'idle' | 'saving' | 'saved'
  lastSavedAt: number | null
  clearDraft: () => void
}

export function useDraftAutosave({
  key,
  data,
  enabled = true,
  onSave
}: UseDraftAutosaveOptions): UseDraftAutosaveReturn {
  const [hasDraft, setHasDraft] = useState(false)
  const [draftData, setDraftData] = useState<DraftData | null>(null)
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false)

  // Checar se existe rascunho ao montar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored) as DraftData
        setHasDraft(true)
        setDraftData(parsed)
        setLastSavedAt(parsed.savedAt)
      }
    } catch {
      // Ignorar erro de parse
    }
  }, [key])

  // Autosave com debounce
  useEffect(() => {
    if (!enabled) return

    // Marcar como "salvando" mas não atualizar UI ainda
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    isSavingRef.current = true
    timeoutRef.current = setTimeout(() => {
      try {
        const payload: DraftData = { ...data, savedAt: Date.now() }
        localStorage.setItem(key, JSON.stringify(payload))
        setLastSavedAt(payload.savedAt)
        setAutosaveStatus('saved')
        onSave?.()
      } catch {
        // Ignorar erro de localStorage (quota, etc)
      } finally {
        isSavingRef.current = false
      }

      // Reset status para idle após 2s
      setTimeout(() => {
        if (!isSavingRef.current) {
          setAutosaveStatus('idle')
        }
      }, 2000)
    }, 2000)

    // Mostrar "salvando..." imediatamente
    setAutosaveStatus('saving')

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [key, data, enabled, onSave])

  const restoreDraft = useCallback(() => {
    if (!draftData) return
    setHasDraft(false)
    setDraftData(null)
  }, [draftData])

  const discardDraft = useCallback(() => {
    localStorage.removeItem(key)
    setHasDraft(false)
    setDraftData(null)
    setLastSavedAt(null)
  }, [key])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key)
  }, [key])

  return {
    hasDraft,
    draftData,
    restoreDraft,
    discardDraft,
    autosaveStatus,
    lastSavedAt,
    clearDraft
  }
}

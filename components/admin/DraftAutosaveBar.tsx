'use client'

interface DraftAutosaveBarProps {
  savedAt: number
  onRestore: () => void
  onDiscard: () => void
}

interface DraftAutosaveBarProps {
  savedAt: number
  onRestore: () => void
  onDiscard: () => void
}

export function DraftAutosaveBar({ savedAt, onRestore, onDiscard }: DraftAutosaveBarProps) {
  const time = new Date(savedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })
  const date = new Date(savedAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  })

  return (
    <div className="bg-brand-secondary/10 border border-brand-secondary/30 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2 flex-1">
          <svg className="w-4 h-4 text-brand-secondary mt-0.5 flex-shrink-0" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-neutral-900">
              Encontramos um rascunho não salvo
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Salvo automaticamente em {date} às {time}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onDiscard}
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="text-sm bg-brand-secondary text-white px-3 py-1 rounded hover:bg-brand-secondary/90 transition-colors font-medium"
          >
            Restaurar
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

interface AutosaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved'
  lastSavedAt: number | null
}

export function AutosaveIndicator({ status, lastSavedAt }: AutosaveIndicatorProps) {
  if (status === 'idle' && !lastSavedAt) return null

  const time = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : null

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {status === 'saving' ? (
        <>
          <svg className="w-3.5 h-3.5 text-gray-400 animate-spin" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-gray-400">Salvando...</span>
        </>
      ) : status === 'saved' && time ? (
        <>
          <svg className="w-3.5 h-3.5 text-gray-400" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-gray-500">
            Salvo automaticamente às {time}
          </span>
        </>
      ) : null}
    </div>
  )
}

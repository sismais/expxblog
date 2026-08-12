'use client'

import { useState } from 'react'

interface Props {
  title?: string
  subtitle?: string
}

export function NewsletterSection({
  title = 'Fique por dentro das novidades',
  subtitle = 'Receba os melhores artigos diretamente no seu e-mail.',
}: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Erro ao se inscrever.')
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setErrorMsg('Erro ao se inscrever. Tente novamente.')
      setStatus('error')
    }
  }

  return (
    <section className="my-12 rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="px-8 py-12 text-center max-w-2xl mx-auto">
        <h2 className="font-display text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-white/70 text-sm mb-8 max-w-lg mx-auto">{subtitle}</p>
        {status === 'success' ? (
          <p className="text-white font-medium">&#10003; Obrigado! Você está inscrito na nossa newsletter.</p>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu e-mail"
                required
                disabled={status === 'loading'}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:opacity-60"
              />
              {/*
                Botão branco com texto na cor primária: a cor de destaque muda por
                template (do cyan claro ao vermelho escuro) e texto branco em cima
                de destaque claro reprova em contraste. O branco funciona nos cinco.
              */}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-2.5 rounded-lg bg-white text-sm font-semibold whitespace-nowrap hover:bg-white/90 transition-colors disabled:opacity-60"
                style={{ color: 'var(--color-primary)' }}
              >
                {status === 'loading' ? 'Aguarde...' : 'Inscrever-se'}
              </button>
            </form>
            {status === 'error' && (
              <p className="mt-3 text-white/80 text-sm">{errorMsg}</p>
            )}
          </>
        )}
      </div>
    </section>
  )
}

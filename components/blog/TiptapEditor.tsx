'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { useState, useRef, useEffect } from 'react'

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
}

export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const [linkPopover, setLinkPopover] = useState<{ visible: boolean; url: string }>({ visible: false, url: '' })
  const [imagePopover, setImagePopover] = useState<{ visible: boolean; uploading: boolean; error: string }>({
    visible: false,
    uploading: false,
    error: ''
  })
  const linkInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageAltRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (linkPopover.visible) linkInputRef.current?.focus()
    if (imagePopover.visible) imageInputRef.current?.focus()
  }, [linkPopover.visible, imagePopover.visible])

  if (!editor) return null

  const openLinkPopover = () => {
    const currentHref = editor.getAttributes('link').href ?? ''
    setLinkPopover({ visible: true, url: currentHref })
  }

  const applyLink = () => {
    const url = linkPopover.url.trim()
    if (!url) {
      editor.chain().focus().unsetLink().run()
    } else {
      const href = url.startsWith('http') ? url : `https://${url}`
      editor.chain().focus().setLink({ href, target: '_blank', rel: 'noopener noreferrer' }).run()
    }
    setLinkPopover({ visible: false, url: '' })
  }

  const removeLink = () => {
    editor.chain().focus().unsetLink().run()
    setLinkPopover({ visible: false, url: '' })
  }

  const openImagePopover = () => {
    setImagePopover({ visible: true, uploading: false, error: '' })
  }

  const handleImageUpload = async () => {
    const fileInput = imageInputRef.current
    const file = fileInput?.files?.[0]
    if (!file) {
      setImagePopover(p => ({ ...p, error: 'Selecione uma imagem' }))
      return
    }

    // Validação de tipo e tamanho (igual ao endpoint)
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    const MAX_SIZE = 5 * 1024 * 1024 // 5MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      setImagePopover(p => ({ ...p, error: 'Formato não suportado. Use JPG, PNG, WebP, GIF ou SVG.' }))
      return
    }

    if (file.size > MAX_SIZE) {
      setImagePopover(p => ({ ...p, error: 'Imagem deve ter menos de 5MB' }))
      return
    }

    setImagePopover(p => ({ ...p, uploading: true, error: '' }))

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setImagePopover(p => ({ ...p, uploading: false, error: data.error ?? 'Erro ao enviar imagem' }))
        return
      }

      // Alt text: usa o valor do input ou o nome do arquivo sem extensão
      const altValue = imageAltRef.current?.value.trim()
      const alt = altValue || file.name.replace(/\.[^/.]+$/, '')

      editor.chain().focus().setImage({ src: data.url, alt }).run()

      // Reset e fechar popover
      setImagePopover({ visible: false, uploading: false, error: '' })
      if (fileInput) fileInput.value = ''
      if (imageAltRef.current) imageAltRef.current.value = ''
    } catch {
      setImagePopover(p => ({ ...p, uploading: false, error: 'Erro de conexão' }))
    }
  }

  const cancelImagePopover = () => {
    setImagePopover({ visible: false, uploading: false, error: '' })
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (imageAltRef.current) imageAltRef.current.value = ''
  }

  const toolbarButtons = [
    { label: 'B', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Negrito' },
    { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'Itálico' },
    { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), title: 'Título 2' },
    { label: 'H3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }), title: 'Título 3' },
    { label: '•', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: 'Lista' },
    { label: '1.', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: 'Lista numerada' },
    { label: '❝', action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), title: 'Citação' },
  ]

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-primary">
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
        {toolbarButtons.map(btn => (
          <button
            key={btn.title}
            type="button"
            onClick={btn.action}
            title={btn.title}
            className={`px-2.5 py-1 text-sm font-medium rounded transition-colors ${
              btn.active ? 'bg-brand-primary text-white' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {btn.label}
          </button>
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={openLinkPopover}
            title="Link"
            className={`px-2.5 py-1 text-sm font-medium rounded transition-colors ${
              editor.isActive('link') ? 'bg-brand-primary text-white' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            🔗
          </button>

          {linkPopover.visible && (
            <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-gray-300 rounded-lg shadow-lg p-2 flex gap-1 min-w-64">
              <input
                ref={linkInputRef}
                type="url"
                value={linkPopover.url}
                onChange={e => setLinkPopover(p => ({ ...p, url: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') applyLink()
                  if (e.key === 'Escape') setLinkPopover({ visible: false, url: '' })
                }}
                placeholder="https://exemplo.com"
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              <button
                type="button"
                onClick={applyLink}
                className="px-2 py-1 text-sm bg-brand-primary text-white rounded hover:opacity-90"
              >
                OK
              </button>
              {editor.isActive('link') && (
                <button
                  type="button"
                  onClick={removeLink}
                  className="px-2 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  title="Remover link"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={openImagePopover}
            title="Inserir imagem"
            className="px-2.5 py-1 text-sm font-medium rounded transition-colors text-gray-600 hover:bg-gray-200"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>

          {imagePopover.visible && (
            <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-gray-300 rounded-lg shadow-lg p-3 flex flex-col gap-2 min-w-72">
              <div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  className="w-full text-sm text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-medium file:bg-brand-primary file:text-white hover:file:opacity-90"
                  disabled={imagePopover.uploading}
                />
              </div>
              <div>
                <input
                  ref={imageAltRef}
                  type="text"
                  placeholder="Texto alternativo (alt)"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  disabled={imagePopover.uploading}
                />
              </div>
              {imagePopover.error && (
                <p className="text-xs text-red-600">{imagePopover.error}</p>
              )}
              <div className="flex gap-1 justify-end">
                <button
                  type="button"
                  onClick={cancelImagePopover}
                  disabled={imagePopover.uploading}
                  className="px-2 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={imagePopover.uploading}
                  className="px-2 py-1 text-sm bg-brand-primary text-white rounded hover:opacity-90 disabled:opacity-50 min-w-20"
                >
                  {imagePopover.uploading ? 'Enviando...' : 'Inserir'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <EditorContent editor={editor} className="prose max-w-none p-4 min-h-48 focus:outline-none" />
    </div>
  )
}

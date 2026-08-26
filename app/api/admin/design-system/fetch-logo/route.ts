import { NextResponse } from 'next/server'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase-admin'
import { checkPublicUrl } from '@/lib/safe-url'
import { inspectImage } from '@/lib/upload-guard'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 2 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawUrl = body?.url

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json({ error: 'Campo "url" é obrigatório' }, { status: 400 })
    }

    const checked = await checkPublicUrl(rawUrl)
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 })
    }
    const parsedUrl = checked.url

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)

    let imgRes: Response
    try {
      imgRes = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogDesignExtractor/1.0)' },
      })
    } finally {
      clearTimeout(timer)
    }

    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Não foi possível baixar a imagem' }, { status: 502 })
    }

    const bytes = new Uint8Array(await imgRes.arrayBuffer())

    if (bytes.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'Imagem maior que 2MB' }, { status: 422 })
    }

    // Antes o tipo saía do Content-Type do servidor remoto, e a URL terminando
    // em .svg forçava image/svg+xml mesmo contra a resposta. Os dois são
    // controlados por quem hospeda a imagem. Agora vale o conteúdo baixado, e
    // SVG com script é recusado.
    const inspected = inspectImage(bytes)
    if (!inspected.ok) {
      return NextResponse.json({ error: inspected.error }, { status: 422 })
    }

    const filename = `logo-${Date.now()}-${Math.random().toString(36).slice(2)}${inspected.ext}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filename, Buffer.from(bytes), { contentType: inspected.kind })

    if (uploadError) {
      console.error('[fetch-logo] upload error:', uploadError)
      return NextResponse.json({ error: 'Erro ao salvar imagem no storage' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort')) {
      return NextResponse.json({ error: 'Timeout ao baixar a imagem' }, { status: 504 })
    }
    console.error('[fetch-logo]', msg)
    return NextResponse.json({ error: 'Erro ao processar logo' }, { status: 500 })
  }
}

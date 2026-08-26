import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Se banco não configurado, redirecionar admin para /setup.
  // `/api/admin/*` precisa ser tratado à parte: não começa com `/admin`, então
  // antes caía no next() e ficava sem nenhuma verificação.
  if (!process.env.DATABASE_URL) {
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json({ error: 'Sistema não instalado' }, { status: 503 })
    }
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/setup', request.url))
    }
    return NextResponse.next()
  }

  // Se já instalado, bloquear /setup
  if (pathname === '/setup' || pathname.startsWith('/setup/')) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const token = request.cookies.get('auth_token')?.value
  const isApiRoute = pathname.startsWith('/api/admin')
  const isLoginPage = pathname === '/admin/login'

  if (isLoginPage) return NextResponse.next()

  const payload = token ? await verifyToken(token) : null

  if (!payload) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  // Injeta no REQUEST, não na resposta. Antes ia na resposta, o que expunha o
  // e-mail do admin ao cliente e não entregava nada ao route handler.
  // Partir de request.headers e usar .set() sobrescreve qualquer x-user-id que
  // o cliente tenha mandado, então o handler pode confiar no valor.
  const headers = new Headers(request.headers)
  headers.set('x-user-id', String(payload.userId))
  headers.set('x-user-email', payload.email)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/setup', '/setup/:path*'],
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  serverExternalPackages: ['css-tree'],

  // Headers de segurança em toda resposta.
  // Referrer-Policy importa aqui porque o link de pré-visualização carrega o
  // token na query string — sem isso o path vaza no Referer para outro site.
  // CSP fica de fora de propósito: o layout injeta <style> inline com as CSS
  // vars do tema, então exigiria nonce e é mudança para outra entrega.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig

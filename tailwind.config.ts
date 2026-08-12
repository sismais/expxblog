import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--color-primary)',
          'primary-dark': 'var(--color-primary-dark)',
          'primary-light': 'var(--color-primary-light)',
          secondary: 'var(--color-secondary)',
          'secondary-dark': 'var(--color-secondary-dark)',
          'secondary-light': 'var(--color-secondary-light)',
        },
        neutral: {
          900: '#1A1A2E',
        },
      },
      // As famílias apontam para as CSS vars que o app/layout.tsx injeta a partir
      // de site_settings.design_system. O valor literal fica só como fallback,
      // para o caso das vars não existirem (ex.: página renderizada sem banco).
      fontFamily: {
        display: ['var(--font-display)', 'Poppins', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', '"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', '"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config

import type { Config } from 'tailwindcss'

/**
 * Tailwind is a thin mapping onto the tokens in src/app/globals.css.
 * Nothing here is a colour value — every entry resolves to a CSS variable
 * so the whole app re-themes from one file. Add a token there first,
 * then expose it here.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          page: 'var(--bg-page)',
          base: 'var(--bg-base)',
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
          input: 'var(--bg-input)',
          overlay: 'var(--bg-overlay)',
          glass: 'var(--bg-glass)',
          'glass-light': 'var(--bg-glass-light)',
          'glass-heavy': 'var(--bg-glass-heavy)',
        },
        card: {
          DEFAULT: 'var(--bg-card)',
          nested: 'var(--bg-card-nested)',
        },
        border: {
          primary: 'var(--border-primary)',
          secondary: 'var(--border-secondary)',
          strong: 'var(--border-strong)',
          accent: 'var(--border-accent)',
          glass: 'var(--border-glass)',
          'glass-bright': 'var(--border-glass-bright)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          inverse: 'var(--text-inverse)',
          'on-accent': 'var(--text-on-accent)',
        },
        /* Trade side. One convention everywhere: green buy / red sell.
         * Alpha composes: bg-buy/10, border-sell/25. */
        buy: {
          DEFAULT: 'rgb(var(--buy-rgb) / <alpha-value>)',
          light: 'rgb(var(--buy-light-rgb) / <alpha-value>)',
          dark: 'rgb(var(--buy-dark-rgb) / <alpha-value>)',
        },
        sell: {
          DEFAULT: 'rgb(var(--sell-rgb) / <alpha-value>)',
          light: 'rgb(var(--sell-light-rgb) / <alpha-value>)',
          dark: 'rgb(var(--sell-dark-rgb) / <alpha-value>)',
        },
        /* Status. success/danger share the buy/sell hues on purpose. */
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        info: 'rgb(var(--info-rgb) / <alpha-value>)',
        /* Brand accent. */
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
          soft: 'var(--accent-soft)',
          light: 'rgb(var(--accent-bright-rgb) / <alpha-value>)',
          dark: 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
        },
        /* Marketing (landing / portal) palette — outside the app tokens. */
        primary: {
          bg: '#FFFFFF',
          secondary: '#FAFAFA',
          accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
          purple: 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
        },
      },
      ringColor: {
        DEFAULT: 'var(--ring)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, var(--accent-bright) 0%, var(--accent) 50%, var(--accent-hover) 100%)',
        'gradient-hero': 'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 50%, #F5F5F5 100%)',
        'gradient-section': 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
        'gradient-section-alt': 'linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)',
      },
      fontFamily: {
        sans: ['var(--font-ui)'],
        body: ['var(--font-ui)'],
        /* `mono` is the numeric face: every balance / price / P&L. */
        mono: ['var(--font-num)'],
        numeric: ['var(--font-num)'],
        display: ['var(--font-display)', 'Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xxs': ['10px', { lineHeight: '14px' }],
        'xs': ['11px', { lineHeight: '16px' }],
        'sm': ['12px', { lineHeight: '16px' }],
        'base': ['13px', { lineHeight: '20px' }],
        'md': ['14px', { lineHeight: '20px' }],
        'lg': ['16px', { lineHeight: '24px' }],
        'xl': ['20px', { lineHeight: '28px' }],
        '2xl': ['28px', { lineHeight: '36px' }],
        '3xl': ['36px', { lineHeight: '44px' }],
        'display-h1-sm':  ['40px', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-h1':     ['72px', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-h2-sm':  ['32px', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        'display-h2':     ['52px', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        'display-h3':     ['22px', { lineHeight: '1.25' }],
        'display-h3-lg':  ['28px', { lineHeight: '1.22' }],
        'body-lg':        ['17px', { lineHeight: '1.55' }],
        'body-md':        ['15px', { lineHeight: '1.6' }],
        'caption':        ['12px', { lineHeight: '1.4', letterSpacing: '0.08em' }],
      },
      letterSpacing: {
        'caption':        '0.08em',
        'wordmark':       '0.18em',
        'display-tight':  '-0.03em',
        'display-snug':   '-0.025em',
      },
      maxWidth: {
        'container':      '1280px',
      },
      /* Two radii on purpose: 6px controls (sm/md), 10px surfaces (lg…),
       * 14px sheets (`rounded-sheet`). Pills use rounded-full. */
      borderRadius: {
        sm: 'var(--radius-sm)', DEFAULT: 'var(--radius-sm)', md: 'var(--radius-sm)',
        lg: 'var(--radius-md)', xl: 'var(--radius-md)',
        '2xl': 'var(--radius-md)', '3xl': 'var(--radius-md)',
        sheet: 'var(--radius-lg)',
      },
      spacing: {
        '0.5': '2px', '1': '4px', '1.5': '6px', '2': '8px', '3': '12px',
        '4': '16px', '5': '20px', '6': '24px', '8': '32px', '10': '40px',
        '12': '48px',
        'section-y-mobile':   '64px',
        'section-y-desktop':  '96px',
        'gutter':             '24px',
      },
      backdropBlur: { xs: '2px', glass: '16px', 'glass-heavy': '24px', 'glass-ultra': '40px' },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'flash-up': 'flashUp 0.15s ease-out',
        'flash-down': 'flashDown 0.15s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        flashUp: { '0%': { backgroundColor: 'rgb(var(--buy-rgb) / 0.22)' }, '100%': { backgroundColor: 'transparent' } },
        flashDown: { '0%': { backgroundColor: 'rgb(var(--sell-rgb) / 0.2)' }, '100%': { backgroundColor: 'transparent' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      /* One depth scale, three steps. Legacy names stay so nothing breaks
       * at call sites, but they all resolve to the same three tokens. */
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        'modal': 'var(--shadow-lg)',
        'dropdown': 'var(--shadow-md)',
        'glass': 'var(--shadow-md)',
        'glass-sm': 'var(--shadow-sm)',
        'glass-lg': 'var(--shadow-lg)',
        'inner-light': 'inset 0 1px 0 0 rgba(255,255,255,0.04)',
        'skeu': 'var(--shadow-sm)',
        'glow-blue': 'var(--shadow-sm)',
        'glow-red': 'var(--shadow-sm)',
        'neon-green-sm': 'var(--shadow-sm)',
        'neon-green-lg': 'var(--shadow-md)',
      },
    },
  },
  plugins: [],
}

export default config

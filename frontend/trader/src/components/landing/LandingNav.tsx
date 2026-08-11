'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Globe, Menu, X } from 'lucide-react';
import { LANGS, useLandingLang } from './i18n';

function Lockup({ dark }: { dark: boolean }) {
  return (
    <Link href="/" aria-label="PowerTradeFX home" className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" aria-hidden="true" className="w-8 h-8 shrink-0">
        <rect width="32" height="32" rx="7" className="fill-accent" />
        <path fillRule="evenodd" d="M11 6.5 H19.2 C23.3 6.5 26.2 9.3 26.2 13.2 C26.2 17.1 23.3 19.9 19.2 19.9 H15.2 V25.5 H11 Z M15.2 10.2 V16.2 H18.9 C20.9 16.2 22 15 22 13.2 C22 11.4 20.9 10.2 18.9 10.2 Z" fill="#ffffff" />
      </svg>
      <span className="inline-flex items-baseline font-display font-bold tracking-tight text-xl select-none">
        <span className={dark ? 'text-white' : 'text-gray-900'}>PowerTrade</span>
        <span className="text-accent">FX</span>
      </span>
    </Link>
  );
}

function LangMenu({ dark }: { dark: boolean }) {
  const { lang, setLang } = useLandingLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
          dark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="w-4 h-4 text-accent" />
        {lang.toUpperCase()}
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-2 w-36 rounded-xl lx-card p-1.5 z-50 shadow-xl"
        >
          {LANGS.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button
                type="button"
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  l.code === lang ? 'text-accent font-semibold' : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LandingNav({ dark = true }: { dark?: boolean }) {
  const { t } = useLandingLang();
  const [mobile, setMobile] = useState(false);
  const links = [
    { href: '/#markets', label: t('nav.markets') },
    { href: '/#features', label: t('nav.features') },
    { href: '/contact', label: t('nav.contact') },
  ];
  return (
    <header className="sticky top-0 z-40">
      <div className={dark ? 'lx-glass' : 'bg-white/85 backdrop-blur-md border-b border-gray-200'}>
        <nav className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between gap-6">
          <Lockup dark={dark} />
          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition-colors ${
                  dark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-5">
            <LangMenu dark={dark} />
            <Link
              href="/auth/login"
              className={`text-sm font-semibold transition-colors ${
                dark ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              {t('nav.signin')}
            </Link>
            <Link
              href="/auth/register"
              className="lx-cta text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:brightness-110 transition"
            >
              {t('nav.open')}
            </Link>
          </div>
          <button
            type="button"
            className={`md:hidden ${dark ? 'text-white' : 'text-gray-900'}`}
            onClick={() => setMobile((m) => !m)}
            aria-label="Menu"
          >
            {mobile ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>
        {mobile && (
          <div className={`md:hidden px-5 pb-5 pt-1 space-y-3 ${dark ? '' : 'bg-white'}`}>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobile(false)}
                className={`block text-sm font-medium ${dark ? 'text-gray-200' : 'text-gray-700'}`}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex items-center gap-4 pt-2">
              <LangMenu dark={dark} />
              <Link href="/auth/login" className="text-sm font-semibold text-accent">
                {t('nav.signin')}
              </Link>
              <Link
                href="/auth/register"
                className="lx-cta text-white text-sm font-semibold px-4 py-2 rounded-lg"
              >
                {t('nav.open')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

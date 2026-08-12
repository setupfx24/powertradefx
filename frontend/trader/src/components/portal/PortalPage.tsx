'use client';

/**
 * Portal page — the dark-label design system as one reusable surface.
 *
 * Structure and motion live here; every word comes in through `content`,
 * so the marketing home (`/`) and the Nocturne reference build (`/label`)
 * are the SAME implementation and cannot drift apart.
 *
 * Two motion models, deliberately different:
 *
 *   1. The portal hero is bound to scroll POSITION. The page writes a
 *      single 0..1 custom property (--p) each frame and the stylesheet
 *      derives every transform from it, so the portal closes again on
 *      the way back up. No timers, no one-way tweens.
 *   2. Entry reveals elsewhere LATCH — IntersectionObserver adds the
 *      class once and then unobserves, so nothing un-reveals.
 *
 * Both are gated behind `.motionOn`, applied only after confirming
 * prefers-reduced-motion is not set. The base stylesheet renders the
 * FINISHED page, so the reduced-motion and no-JS renders are complete
 * rather than blank. See portal.module.css for the full contract.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './portal.module.css';
import PortalNav, { type PortalLink } from './PortalNav';
import PortalFooter from './PortalFooter';
import FallingText from '../FallingText';

/* ── Content contract ────────────────────────────────────────── */

export type { PortalLink };

/** One card in the throwable deck. */
export type PortalDeckItem = {
  /** Small accent label, top-left of the sleeve (release code, asset class…). */
  tag: string;
  /** Small muted label, top-right (format, tier…). */
  meta: string;
  title: string;
  /** Sub-line under the title. */
  sub: string;
  /** Must match a roster row's `name` — the integrity check enforces it. */
  group: string;
  /** Sleeve image for this card. Omit it and the card falls back to the
   *  generated SleeveArt, which is what /label does. */
  art?: string;
};

export type PortalRosterRow = {
  tag: string;
  name: string;
  count: number;
  unit: string;
  /** Where the row leads. Omit and the row renders as static text — the
   *  /label reference build has no per-class pages behind it. */
  href?: string;
};

export type PortalContent = {
  /** Wordmark split into the two halves that travel to opposite edges. */
  wordmark: { a: string; b: string };
  nav: {
    links: PortalLink[];
    cta: PortalLink;
    /** Wordmark lockup for the fixed bar. Omit it and the bar sets the mark
     *  in type, which is what /label does. */
    logo?: string;
  };
  hero: { cornerTL: string; cornerTR: string; cornerBLa: string; cornerBLb: string; cornerBR: string };
  statement: {
    label: string;
    lead: string;
    amber: string;
    tail: string;
    index: string;
    /** Render the sentence as physics-driven falling words that drop on
     *  hover. The static paragraph is the default, and is still what
     *  reduced-motion readers get — FallingText renders the full sentence
     *  and simply never starts the simulation. */
    falling?: boolean;
  };
  deck: {
    id: string;
    label: string;
    heading: string;
    lede: string;
    actions: PortalLink[];
    hint: string;
    items: PortalDeckItem[];
  };
  roster: { id: string; label: string; heading: string; rows: PortalRosterRow[] };
  table: {
    id: string;
    label: string;
    heading: string;
    headers: [string, string, string, string];
    rows: { a: string; b: string; c: string; d: string; tone?: 'low' | 'out' }[];
  };
  close: {
    id: string;
    label: string;
    heading: string;
    fine: string;
    actions: PortalLink[];
    footLeft: string;
    footRight: string;
    /** Wordmark cropped by the page edge; usually `${a}${b}` plus a period. */
    mark: string;
  };
  art: {
    hero: string;
    /** Circular image floating off the statement fold's right edge.
     *  Optional: omit it and the fold keeps only its ambient wash, which
     *  is what the marketing home does. */
    plate?: string;
  };
};

/* ── Motion opt-in ───────────────────────────────────────────── */

const MOTION_SCRIPT = `(function(){try{if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;var s=document.currentScript,el=s&&s.parentElement;if(el)el.classList.add('__MOTION__');}catch(e){}})();`;

/* CSS-module lookups are typed `string | undefined` under this project's
   noUncheckedIndexedAccess, and the DOM APIs these feed (classList.add,
   querySelectorAll) reject undefined. Pin them once, with the authored
   name as a fallback so a class name is never empty at runtime. */
const CLASS_MOTION_ON = styles.motionOn ?? 'motionOn';
const CLASS_REVEAL = styles.reveal ?? 'reveal';
const CLASS_IS_IN = styles.isIn ?? 'isIn';

/* Wordmark sizing is CONTENT-DEPENDENT: a 12-letter wordmark cannot use
   the same vw as an 8-letter one without running off the screen. Derived
   from glyph count and expressed purely in vw, so the mark fits the frame
   at every viewport width by construction rather than by breakpoint.
   Constants tuned against Syne 800 and verified by measurement. */
const titleVw = (glyphs: number) => `${(76 / Math.max(glyphs, 1)).toFixed(2)}vw`;
const closeVw = (glyphs: number) => `${(88 / Math.max(glyphs, 1)).toFixed(2)}vw`;

/* How long a card takes to leave or arrive. MUST equal --flip in
   portal.module.css: the stylesheet animates the travel and these timers
   decide when the deck re-stacks, so if they drift the card is either
   snatched mid-flight or sits still at the end of one. */
const FLIP_MS = 520;

/* ── Deck chrome ─────────────────────────────────────────────── */

/** Stroked chevron for the two deck arrows. `currentColor` so it inherits
 *  the button's hover state instead of needing its own rule. */
function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={dir === 'left' ? 'M10 3 L5 8 L10 13' : 'M6 3 L11 8 L6 13'} />
    </svg>
  );
}

/* ── Sleeve art ──────────────────────────────────────────────── */

/** Deterministic per-card art built from the same two accents as the hero
 *  image, so the deck sits inside the page palette. */
function SleeveArt({ seed }: { seed: number }) {
  const rot = seed * 37;
  const cx = 30 + ((seed * 17) % 42);
  const cy = 26 + ((seed * 29) % 40);
  return (
    <svg className={styles.cardArt} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`pw${seed}`} cx={`${cx}%`} cy={`${cy}%`} r="70%">
          <stop offset="0" stopColor="#E8913C" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#E8913C" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#0A0C0E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`pc${seed}`} x1="0" y1="1" x2="1" y2="0" gradientTransform={`rotate(${rot % 40} .5 .5)`}>
          <stop offset="0" stopColor="#2E6B72" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#101317" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="#101317" />
      <rect width="100" height="100" fill={`url(#pc${seed})`} />
      <rect width="100" height="100" fill={`url(#pw${seed})`} />
      <g fill="none" stroke="#EDE7DC" strokeOpacity="0.14" strokeWidth="0.4">
        {[16, 26, 36, 46, 56].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      {/* Kept in the upper half: lower down it cuts straight through the
          card's tag and title block. */}
      <line
        x1="0"
        y1={40 + (seed % 3) * 6}
        x2="100"
        y2={30 + (seed % 4) * 5}
        stroke="#E8913C"
        strokeOpacity="0.5"
        strokeWidth="0.5"
      />
    </svg>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export default function PortalPage({ content }: { content: PortalContent }) {
  const { wordmark, nav, hero, statement, deck, roster, table, close, art } = content;

  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const statementRef = useRef<HTMLElement>(null);

  /* Catalogue integrity. The deck is a SAMPLE of the catalogue, not all of
     it (see FEATURED_SYMBOLS in marketData), so this checks containment
     rather than equality: every deck item must belong to a roster row, and
     no group may appear on more cards than the roster says exist. Equality
     would fire on every load the moment the deck showed a subset.
     Development only — stripped from production builds. */
  if (process.env.NODE_ENV !== 'production') {
    const tally = deck.items.reduce<Record<string, number>>((acc, item) => {
      acc[item.group] = (acc[item.group] ?? 0) + 1;
      return acc;
    }, {});
    Object.entries(tally).forEach(([group, shown]) => {
      const row = roster.rows.find((r) => r.name === group);
      if (!row) {
        console.error(`[portal] Deck group missing from roster: "${group}".`);
      } else if (shown > row.count) {
        console.error(
          `[portal] Roster/catalogue mismatch: the deck shows ${shown} "${group}" cards but the roster lists only ${row.count}.`,
        );
      }
    });
  }

  /* The app shell hard-codes a light ground on <html> (see app/layout.tsx).
     Borrow it while this page is mounted so overscroll does not flash
     white, and hand it back on unmount. */
  useEffect(() => {
    const root = document.documentElement;
    const prevBg = root.style.backgroundColor;
    const prevFg = root.style.color;
    const prevImg = root.style.backgroundImage;
    root.style.backgroundColor = '#0A0C0E';
    root.style.color = '#EDE7DC';
    root.style.backgroundImage = 'none';
    return () => {
      root.style.backgroundColor = prevBg;
      root.style.color = prevFg;
      root.style.backgroundImage = prevImg;
    };
  }, []);

  /* Motion opt-in, second path.
     The inline <script> below covers the server-rendered case: it runs
     during HTML parse, before first paint, so the portal is never seen
     open before it closes. But a <script> element CREATED BY REACT on the
     client never executes — only parser-inserted scripts do — and this
     page renders client-side inside the app shell, so that path alone
     leaves the motion layer off. Re-assert it here. Adding the class
     twice is harmless; the reduced-motion check is repeated so this path
     can never enable motion the script would have declined. */
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.add(CLASS_MOTION_ON);
  }, []);

  /* Scroll-position → --p (portal) and --q (statement drift). One rAF per
     frame, both clamped 0..1, so scrolling back up rewinds the hero. */
  useEffect(() => {
    const page = pageRef.current;
    const heroEl = heroRef.current;
    if (!page || !heroEl) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;

      /* The stage is sticky for (heroHeight - vh) of scrolling. Finish the
         portal at 80% of that so the uncovered image holds for a beat
         before the stage releases. */
      const travel = (heroEl.offsetHeight - vh) * 0.8;
      const scrolled = -heroEl.getBoundingClientRect().top;
      const p = travel > 0 ? Math.min(1, Math.max(0, scrolled / travel)) : 1;
      page.style.setProperty('--p', p.toFixed(4));

      const statementEl = statementRef.current;
      if (statementEl) {
        const rect = statementEl.getBoundingClientRect();
        const span = vh + rect.height;
        const q = span > 0 ? Math.min(1, Math.max(0, (vh - rect.top) / span)) : 0;
        page.style.setProperty('--q', q.toFixed(4));
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  /* Latching reveals — unobserve on first intersection so they never play
     backwards. */
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const targets = Array.from(page.querySelectorAll(`.${CLASS_REVEAL}`));
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add(CLASS_IS_IN));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(CLASS_IS_IN);
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ── Throwable deck ───────────────────────────────────────── */

  const deckRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const items = deck.items;
  const [order, setOrder] = useState<number[]>(() => items.map((_, i) => i));
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState<0 | 1 | -1>(0);
  /* The mirror of `flying`: a card being pulled BACK to the top starts off
     the frame on this side and travels home. Only ever non-zero for the one
     muted frame that parks it there. */
  const [entering, setEntering] = useState<0 | 1 | -1>(0);
  /* The ONE card whose transition is off for a frame, because it teleports:
     the thrown card jumping to the back, or the pulled card being parked
     off-frame. Deliberately not a boolean over the whole deck — muting every
     card is what made the others snap a place forward instead of gliding. */
  const [muted, setMuted] = useState<number | null>(null);
  /* Input gate. Held for the full flip so a fast clicker cannot stack two
     animations on top of each other. */
  const [locked, setLocked] = useState(false);
  const busy = locked;

  const throwCard = useCallback(
    (dir: 1 | -1) => {
      if (locked) return;
      /* Read off this render's order: `locked` guarantees nothing else
         reorders the deck before the timer fires. */
      const thrown = order[0]!;
      setLocked(true);
      setDragging(false);
      setDx(0);
      setFlying(dir);
      window.setTimeout(() => {
        setMuted(thrown);
        setFlying(0);
        setOrder((o) => [...o.slice(1), o[0]!]);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setMuted(null);
            setLocked(false);
          }),
        );
      }, FLIP_MS);
    },
    [locked, order],
  );

  /* throwCard in reverse, and the reason the arrows are not both throws:
     the deck only ever advances, so a "previous" has to bring the BACK card
     forward. It goes on top and is parked off-frame for one muted frame,
     then released — it slides and fades in while the cards it displaced
     glide back a place. */
  const pullCard = useCallback(
    (dir: 1 | -1) => {
      if (locked || order.length < 2) return;
      const pulled = order[order.length - 1]!;
      setLocked(true);
      setDragging(false);
      setDx(0);
      setMuted(pulled);
      setEntering(dir);
      setOrder((o) => [o[o.length - 1]!, ...o.slice(0, -1)]);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setMuted(null);
          setEntering(0);
          window.setTimeout(() => setLocked(false), FLIP_MS);
        }),
      );
    },
    [locked, order],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || busy) return;
    setDx(e.clientX - startX.current);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const width = deckRef.current?.offsetWidth ?? 360;
    if (Math.abs(dx) > width * 0.1) throwCard(dx > 0 ? 1 : -1);
    else {
      setDragging(false);
      setDx(0);
    }
  };

  /* Right advances, left steps back — the same pairing as the two arrow
     buttons, so keyboard and pointer never disagree about direction. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      throwCard(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      pullCard(-1);
    }
  };

  const goTo = (target: number) => {
    if (busy) return;
    setOrder((o) => {
      const at = o.indexOf(target);
      return at <= 0 ? o : [...o.slice(at), ...o.slice(0, at)];
    });
  };

  const cardTransform = (pos: number): string => {
    if (pos === 0) {
      if (flying) return `translate3d(${flying * 120}%, -8%, 0) rotate(${flying * 20}deg) scale(1.02)`;
      /* Same expression as `flying`: a pulled card leaves from exactly where
         a thrown one lands, so the two directions read as one motion. */
      if (entering)
        return `translate3d(${entering * 120}%, -8%, 0) rotate(${entering * 20}deg) scale(1.02)`;
      if (dragging && dx !== 0) return `translate3d(${dx}px, 0, 0) rotate(${dx * 0.055}deg) scale(1.03)`;
    }
    const tilt = pos % 2 === 0 ? -pos * 1.15 : pos * 1.35;
    return `translate3d(${pos * 11}px, ${pos * -7}px, 0) scale(${1 - pos * 0.045}) rotate(${tilt}deg)`;
  };

  const top = items[order[0]!]!;

  const sizing = useMemo(
    () =>
      ({
        '--title-vw': titleVw(wordmark.a.length + wordmark.b.length),
        '--close-vw': closeVw(close.mark.length),
      }) as React.CSSProperties,
    [wordmark.a, wordmark.b, close.mark],
  );

  return (
    /* suppressHydrationWarning: the inline script below adds `motionOn` to
       this element during HTML parse, so the DOM legitimately carries a
       class the server markup does not. Same trade the root layout makes
       for its theme bootloader. Only this one attribute is exempted. */
    <div
      ref={pageRef}
      className={styles.page}
      style={sizing}
      data-nocturne="page"
      suppressHydrationWarning
    >
      <script dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT.replace('__MOTION__', CLASS_MOTION_ON) }} />

      {/* ── Navigation (shared with the sub-pages) ─────────── */}
      <PortalNav
        mark={close.mark}
        links={nav.links}
        cta={nav.cta}
        homeHref="#top"
        {...(nav.logo ? { logo: nav.logo } : {})}
      />

      {/* ── 1. Portal hero ─────────────────────────────────── */}
      <header id="top" className={styles.hero} ref={heroRef}>
        <div className={styles.stage}>
          <div className={styles.stageImage} style={{ backgroundImage: `url(${art.hero})` }} />
          <div className={styles.stageDuotone} />
          <div className={styles.stageVeil} />

          {/* data-nocturne hooks exist so the portal's travel can be
              MEASURED rather than assumed. CSS-module class names are
              hashed and differ between dev and prod, so they are not a
              stable handle for that check. */}
          <div className={`${styles.panel} ${styles.panelL}`} data-nocturne="panel-left" />
          <div className={`${styles.panel} ${styles.panelR}`} data-nocturne="panel-right" />

          <span className={`${styles.dot} ${styles.dotA}`} />
          <span className={`${styles.dot} ${styles.dotB}`} />

          <div className={styles.titleWrap}>
            <h1 className={styles.title} data-nocturne="title">
              <span className={styles.titleA} data-nocturne="title-a">{wordmark.a}</span>
              <span className={styles.titleB} data-nocturne="title-b">{wordmark.b}</span>
            </h1>
          </div>

          <div className={`${styles.corner} ${styles.cornerTL}`}>
            <span className={styles.label}>{hero.cornerTL}</span>
          </div>
          <div className={`${styles.corner} ${styles.cornerTR}`}>
            <span className={styles.label}>{hero.cornerTR}</span>
          </div>
          <div className={`${styles.corner} ${styles.cornerBL}`}>
            <span className={styles.label}>{hero.cornerBLa}</span>
            <span className={`${styles.label} ${styles.labelAmber}`}>·</span>
            <span className={styles.label}>{hero.cornerBLb}</span>
          </div>
          <div className={`${styles.corner} ${styles.cornerBR}`}>
            <span className={styles.label}>{hero.cornerBR}</span>
          </div>
        </div>
      </header>

      {/* ── 2. Statement fold ──────────────────────────────── */}
      <section className={styles.statement} ref={statementRef}>
        {art.plate && (
          <div className={styles.plate} style={{ backgroundImage: `url(${art.plate})` }} />
        )}
        <div className={styles.statementInner}>
          <div className={styles.reveal}>
            <span className={styles.label}>{statement.label}</span>
            {statement.falling ? (
              /* Same sentence, same two colours. highlightWords is derived
                 from the amber phrase rather than typed out again, so the
                 orange words here are exactly the orange words in the
                 static version and cannot drift from it. */
              <div className={styles.fallStage}>
                <FallingText
                  text={`${statement.lead}${statement.amber}${statement.tail}`}
                  highlightWords={statement.amber.split(/\s+/).filter(Boolean)}
                  highlightClass={styles.fallAmber ?? ''}
                  className={styles.fallText ?? ''}
                  trigger="hover"
                  backgroundColor="transparent"
                  gravity={0.56}
                  mouseConstraintStiffness={0.9}
                  fontSize="clamp(24px, 3.6vw, 52px)"
                />
              </div>
            ) : (
              <p className={styles.statementText}>
                {statement.lead}
                <em>{statement.amber}</em>
                {statement.tail}
              </p>
            )}
          </div>
          <span className={styles.index} aria-hidden="true">{statement.index}</span>
        </div>
      </section>

      {/* ── 3. Deck ────────────────────────────────────────── */}
      <section id={deck.id} className={styles.releases}>
        <div className={styles.releasesGrid}>
          <div className={`${styles.releasesCopy} ${styles.reveal}`}>
            <span className={styles.label}>{deck.label}</span>
            <h2 className={styles.heading}>{deck.heading}</h2>
            <p className={styles.lede}>{deck.lede}</p>
            <div className={styles.releasesActions}>
              {/* Route hrefs go through next/link so the click is a
                  client-side navigation rather than a full reload; hash
                  and mailto: hrefs stay plain anchors so the browser
                  handles them. Same split as PortalNav and PortalFooter —
                  the /label build passes '#dates' here, so a blanket
                  <Link> would break it. */}
              {deck.actions.map((a, i) => {
                const cls = `${styles.btn} ${i > 0 ? styles.btnQuiet : ''}`;
                return a.href.startsWith('/') ? (
                  <Link key={a.href} className={cls} href={a.href}>
                    {a.label}
                  </Link>
                ) : (
                  <a key={a.href} className={cls} href={a.href}>
                    {a.label}
                  </a>
                );
              })}
            </div>
          </div>

          <div className={styles.deckCol}>
            {/* The arrows are siblings of the stack, not children: a card
                inside it swallows pointer events while it is on top, and the
                back cards fan out to the right, so a button placed within
                would be either unclickable or covered. */}
            <div className={styles.deckStage}>
              {/* suppressHydrationWarning on the three deck controls below:
                  form-filler extensions (password managers and the like) stamp
                  an `fdprocessedid` attribute onto every button and input
                  BEFORE React hydrates, and React then reports the DOM it
                  found as not matching what this component rendered. Nothing
                  here is client-only — every attribute is derived from props
                  or from the initial `order` state, which the server and the
                  client compute identically — so the check has nothing real
                  to catch and only fires on that injected attribute. It is
                  per-element and one level deep, so the Chevron inside is
                  still compared normally. */}
              <button
                type="button"
                className={`${styles.deckArrow} ${styles.deckArrowPrev}`}
                onClick={() => pullCard(-1)}
                aria-label="Previous market"
                aria-controls={deck.id}
                suppressHydrationWarning
              >
                <Chevron dir="left" />
              </button>

              {/* The deck IS an interactive widget: the ARIA authoring-practices
                  carousel pattern puts tabindex and arrow-key handling on the
                  group container itself, which these two rules cannot model.
                  The keyboard path is asserted by the browser check, and the
                  arrows and progress dots are native <button>s, so every card
                  also has routes that need no arrow keys. */}
              {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
              <div
                ref={deckRef}
                className={styles.deck}
                data-nocturne="deck"
                tabIndex={0}
                role="group"
                aria-roledescription="card deck"
                aria-label={`${deck.heading} Showing ${top.tag}, ${top.title}. Use the left and right arrow keys to flip through.`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onKeyDown}
              >
                {items.map((item, i) => {
                  const pos = order.indexOf(i);
                  const isTop = pos === 0;
                  /* Hidden while a card teleports (see `muted`) and while the
                     top card is mid-throw, so both ends of the swap fade
                     instead of popping. */
                  const hidden = muted === i || (isTop && flying !== 0) || pos > 3;
                  return (
                    <article
                      key={item.title}
                      className={`${styles.card} ${(isTop && dragging) || muted === i ? styles.cardStill : ''}`}
                      style={{
                        transform: cardTransform(pos),
                        zIndex: items.length - pos,
                        opacity: hidden ? 0 : 1,
                        pointerEvents: isTop ? 'auto' : 'none',
                      }}
                      aria-hidden={!isTop}
                    >
                      {item.art ? (
                        <Image
                          className={styles.cardPhoto}
                          src={item.art}
                          alt=""
                          fill
                          /* The stack never renders wider than the 460px
                             stage, so asking for more is wasted bytes. */
                          sizes="(max-width: 900px) 92vw, 460px"
                          priority={i === 0}
                        />
                      ) : (
                        <SleeveArt seed={i + 1} />
                      )}
                      {/* The title block sits on an arbitrary photograph, so
                          it needs its own ground to stay legible. */}
                      <div className={styles.cardScrim} aria-hidden="true" />
                      <div className={styles.cardBody}>
                        <div className={styles.cardCode}>
                          <span className={`${styles.label} ${styles.labelAmber}`}>{item.tag}</span>
                          <span className={styles.label}>{item.meta}</span>
                        </div>
                        <h3 className={styles.cardTitle}>{item.title}</h3>
                        <p className={styles.cardArtist}>{item.sub}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
              {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}

              <button
                type="button"
                className={`${styles.deckArrow} ${styles.deckArrowNext}`}
                onClick={() => throwCard(1)}
                aria-label="Next market"
                aria-controls={deck.id}
                suppressHydrationWarning
              >
                <Chevron dir="right" />
              </button>
            </div>

            <p className={styles.deckHint}>{deck.hint}</p>
            <div className={styles.deckDots}>
              {items.map((item, i) => (
                <button
                  key={item.title}
                  type="button"
                  className={`${styles.deckDot} ${order[0] === i ? styles.deckDotOn : ''}`}
                  aria-label={`Show ${item.title}`}
                  aria-current={order[0] === i}
                  onClick={() => goTo(i)}
                  suppressHydrationWarning
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Roster ──────────────────────────────────────── */}
      <section id={roster.id} className={styles.roster}>
        <div className={`${styles.sectionHead} ${styles.reveal}`}>
          <h2 className={styles.heading}>{roster.heading}</h2>
          <span className={styles.label}>{roster.label}</span>
        </div>
        <div className={styles.rosterList}>
          {roster.rows.map((row) => {
            const cells = (
              <>
                <span className={`${styles.label} ${styles.labelAmber}`}>{row.tag}</span>
                <span className={styles.rosterName}>{row.name}</span>
                <span className={styles.rosterCount}>
                  {String(row.count).padStart(2, '0')} {row.unit}
                  {row.count === 1 ? '' : 's'}
                </span>
              </>
            );

            /* Anchor, not a div with onClick: the row must open in a new
               tab on middle-click and be reachable by keyboard, and the
               grid layout survives the swap because .rosterRow sets
               display:grid on whatever element carries it. */
            return row.href ? (
              <Link
                key={row.name}
                href={row.href}
                className={`${styles.rosterRow} ${styles.rosterLink} ${styles.reveal}`}
                aria-label={`${row.name} — ${row.count} ${row.unit}${row.count === 1 ? '' : 's'}`}
              >
                {cells}
              </Link>
            ) : (
              <div key={row.name} className={`${styles.rosterRow} ${styles.reveal}`}>
                {cells}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 5. Table ───────────────────────────────────────── */}
      <section id={table.id} className={styles.dates}>
        <div className={`${styles.sectionHead} ${styles.reveal}`}>
          <h2 className={styles.heading}>{table.heading}</h2>
          <span className={styles.label}>{table.label}</span>
        </div>
        <table className={`${styles.table} ${styles.reveal}`}>
          <thead>
            <tr>
              {table.headers.map((h) => (
                <th key={h} scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={`${r.a}-${r.b}`}>
                <td>{r.a}</td>
                <td>{r.b}</td>
                <td>{r.c}</td>
                <td>
                  <span
                    className={`${styles.status} ${
                      r.tone === 'low' ? styles.statusLow : r.tone === 'out' ? styles.statusOut : ''
                    }`}
                  >
                    {r.d}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── 6. Close (shared with the sub-pages) ───────────── */}
      <PortalFooter
        id={close.id}
        label={close.label}
        heading={close.heading}
        fine={close.fine}
        actions={close.actions}
        footLeft={close.footLeft}
        footRight={close.footRight}
        mark={close.mark}
      />
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import PortalHero from '@/components/portal/PortalHero';
import styles from '@/components/portal/portal.module.css';
import { PORTAL_BRAND } from '@/components/portal/brand';

/**
 * Contact — the third entry in the bar.
 *
 * Replaces the old white `(landing)/contact` page. That one carried a
 * form with no submit handler and no endpoint behind it, so "Send
 * Message" silently did nothing, and it advertised 24/7 support and a
 * one-hour response against PORTAL_BRAND.contact.hours, which says the
 * desk runs 24/5 with the markets.
 *
 * There is no PUBLIC contact endpoint in this repo — /support/tickets is
 * behind auth (and disallowed in robots.ts). So everything below is a
 * mailto or a link to the signed-in ticket queue. Do NOT reintroduce a
 * form here unless a public endpoint exists to receive it.
 */

export const metadata: Metadata = {
  title: 'Contact — PowerTradeFX',
  description:
    'Reach the PowerTradeFX desk by email, or open a support ticket from inside your account.',
};

const { contact, legalName } = PORTAL_BRAND;

/** Topic buttons, so the mail lands with its subject already set. */
const TOPICS = [
  { label: 'General enquiry', subject: 'General enquiry' },
  { label: 'Account help', subject: 'Account help' },
  { label: 'Technical issue', subject: 'Technical issue' },
];

const mailto = (subject: string) =>
  `mailto:${contact.email}?subject=${encodeURIComponent(subject)}`;

export default function ContactPage() {
  return (
    <>
      {/* The eyebrow tracks PORTAL_BRAND.contact.hours; if that changes,
          this changes with it. */}
      <PortalHero
        src="/portal/contact_banner.png"
        alt="Someone at a desk holding an orange telephone handset"
        title="The desk."
        eyebrow="24/5 · With the markets"
        lede="Email reaches the desk directly. If you are already signed in, a support ticket is faster — it arrives with your account already attached."
      />

      <header className={styles.pageHead}>
        <div className={styles.pageHeadInner}>
          <span className={styles.label}>Contact</span>
          <h1 className={styles.pageTitle}>Talk to the desk.</h1>
          <p className={styles.pageLede}>
            One address reaches us, and it is read by people who can see your account. If you are
            already signed in, a support ticket is faster — it arrives with your account attached,
            so nobody has to ask you to confirm who you are first.
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead} style={{ marginBottom: 26 }}>
            <div>
              <span className={`${styles.label} ${styles.labelAmber}`}>01 — Reach us</span>
              <h2 className={styles.sectionTitle}>Where to write</h2>
            </div>
          </div>

          <div className={styles.detailList}>
            <div className={styles.detailRow}>
              <span className={`${styles.label} ${styles.labelAmber}`}>Email</span>
              <span className={styles.detailName}>
                <a className={styles.footLink} href={mailto('Enquiry')}>
                  {contact.email}
                </a>
              </span>
              <p className={styles.detailBlurb}>
                The single address for everything — pre-account questions, funding, platform
                problems. Write from the address on your account and we can find you faster.
              </p>
              <span className={styles.detailCount}>Anyone</span>
            </div>

            <div className={styles.detailRow}>
              <span className={`${styles.label} ${styles.labelAmber}`}>Tickets</span>
              <span className={styles.detailName}>
                <Link className={styles.footLink} href="/support">
                  Support
                </Link>
              </span>
              <p className={styles.detailBlurb}>
                Inside the app. Raise a ticket, follow its replies and keep the thread against your
                account instead of in a mailbox.
              </p>
              <span className={styles.detailCount}>Signed in</span>
            </div>

            <div className={styles.detailRow}>
              <span className={`${styles.label} ${styles.labelAmber}`}>Hours</span>
              <span className={styles.detailName}>24/5</span>
              {/* Deliberately the market's clock, not a staffing promise —
                  see PORTAL_BRAND.contact.hours. */}
              <p className={styles.detailBlurb}>
                {contact.hours} Crypto keeps trading over the weekend, but the desk follows the
                weekday rail like the rest of the markets.
              </p>
              <span className={styles.detailCount}>Mon–Fri</span>
            </div>
          </div>

          <div className={styles.releasesActions}>
            {TOPICS.map((t, i) => (
              <a
                key={t.subject}
                className={`${styles.btn} ${i === 0 ? '' : styles.btnQuiet}`}
                href={mailto(t.subject)}
              >
                {t.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>02 — Before you write</span>
          <h2 className={styles.sectionTitle}>Some answers are already up.</h2>
          <p className={styles.lede} style={{ marginTop: 18 }}>
            What the platform lists, which asset classes it covers and when each market trades are
            all on the site. If your question is one of those, the answer is a click away rather
            than an email away.
          </p>
          <div className={styles.releasesActions}>
            <Link className={styles.btn} href="/platform">
              Platform overview
            </Link>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href="/markets">
              Instruments
            </Link>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href="/sessions">
              Market sessions
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>03 — Who you are writing to</span>
          <h2 className={styles.sectionTitle}>{legalName}</h2>
          <p className={styles.lede} style={{ marginTop: 18 }}>
            We operate online rather than from a public walk-in office, so email and the in-app
            ticket queue are the two routes in. Anything about your data — an export, or deleting
            your account — has its own page.
          </p>
          <div className={styles.releasesActions}>
            <Link className={styles.btn} href="/account-deletion">
              Data and deletion
            </Link>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href="/privacy">
              Privacy
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

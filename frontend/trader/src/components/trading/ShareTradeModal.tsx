'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, Link2, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { Button, Textarea } from '@/components/ui';
import ShareTradeCard from './ShareTradeCard';

type DisplayMode = 'pnl' | 'roi' | 'ticks';

interface Position {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  current_price?: number | null;
  profit?: number;
  commission?: number;
  created_at?: string | null;
}

interface ShareTradeModalProps {
  open: boolean;
  onClose: () => void;
  position: Position | null;
  leverage?: number;
  pipSize?: number;
}

const DISPLAY_MODES: { v: DisplayMode; label: string }[] = [
  { v: 'pnl', label: 'Profit and loss' },
  { v: 'roi', label: 'ROI % compared to margin' },
  { v: 'ticks', label: 'Ticks' },
];

/** Label row with a live character counter on the right. */
function CountedLabel({ id, label, count, max }: { id: string; label: string; count: number; max: number }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</label>
      <span className="text-xxs text-text-tertiary tabular-nums">{count}/{max}</span>
    </div>
  );
}

export default function ShareTradeModal({ open, onClose, position, leverage = 100, pipSize = 0.0001 }: ShareTradeModalProps) {
  const [description, setDescription] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('pnl');
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDescription('');
      setLinkDescription('');
      setDisplayMode('pnl');
      setShareUrl(null);
    }
  }, [open, position?.id]);

  if (!open || !position) return null;

  // A freshly-opened position carries an optimistic "optim-" id until the
  // 1.5s poll reconciles it to the real server UUID (same reason bulk-close
  // filters these out). Sharing one would POST "optim-…" to
  // /positions/{uuid}/share and fail backend UUID validation, so block it
  // with a clear message until the trade is confirmed.
  const isPending = position.id.startsWith('optim-');

  const handleCopyLink = async () => {
    if (isPending) {
      toast.error('Trade is still being confirmed — try again in a moment.');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<{ short_code: string; expires_at: string }>(
        `/positions/${position.id}/share`,
        {
          description: description || null,
          link_description: linkDescription || null,
          display_mode: displayMode,
        },
      );
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/s/${res.short_code}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Link copied to clipboard');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create link');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      link.download = `powertradefx-${position.symbol}-${position.side}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Image downloaded');
    } catch {
      toast.error('Failed to generate image');
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-bg-overlay" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-trade-title"
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-border-primary rounded-sheet shadow-lg"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <h2 id="share-trade-title" className="text-md font-semibold text-text-primary">Share</h2>
          <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose}>
            <X className="w-4 h-4" aria-hidden />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Card preview */}
          <div>
            <div ref={cardRef}>
              <ShareTradeCard
                symbol={position.symbol}
                side={position.side}
                lots={position.lots}
                leverage={leverage}
                openPrice={position.open_price}
                currentPrice={position.current_price ?? position.open_price}
                pnl={(position.profit ?? 0) - (position.commission ?? 0)}
                openedAt={position.created_at ?? null}
                displayMode={displayMode}
                pipSize={pipSize}
                status="active"
                shortUrl={shareUrl ?? 'powertradefx.com/s/xxxxxx'}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-5">
            <div>
              <CountedLabel id="share-card-description" label="Card description" count={description.length} max={140} />
              <Textarea
                id="share-card-description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 140))}
                rows={3}
                placeholder="Describe your trade"
                className="resize-none"
              />
            </div>

            <div>
              <CountedLabel id="share-link-description" label="Online link description" count={linkDescription.length} max={500} />
              <Textarea
                id="share-link-description"
                value={linkDescription}
                onChange={(e) => setLinkDescription(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Share your links, e.g. https://www.instagram.com/..."
                className="resize-none"
              />
              <p className="text-xxs text-text-tertiary mt-1.5">
                Text will be displayed only when the shared link is visited. Share your affiliate or social media links here.
              </p>
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Profit / Loss</legend>
              <div className="space-y-2">
                {DISPLAY_MODES.map((opt) => (
                  <label key={opt.v} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="displayMode"
                      value={opt.v}
                      checked={displayMode === opt.v}
                      onChange={() => setDisplayMode(opt.v)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-text-primary">{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleCopyLink}
                loading={creating}
                disabled={isPending}
                title={isPending ? 'Trade is still being confirmed' : undefined}
                leftIcon={shareUrl ? <Copy className="w-4 h-4" aria-hidden /> : <Link2 className="w-4 h-4" aria-hidden />}
              >
                {shareUrl ? 'Copy Link' : 'Create Link'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={handleDownload}
                leftIcon={<Download className="w-4 h-4" aria-hidden />}
              >
                Download
              </Button>
            </div>

            {isPending && !shareUrl && (
              <p className="text-xs text-text-tertiary">
                Confirming your trade… the share link will be available in a moment.
              </p>
            )}

            {shareUrl && (
              <div className="p-3 rounded-md bg-success/10 border border-success/25 space-y-1.5">
                <p className="text-xs font-semibold text-success">Link Created · valid 7 days</p>
                <p className="text-xs font-mono text-text-primary break-all">{shareUrl}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}

import { create } from 'zustand';

/**
 * Shell layout state for the app navbar.
 *
 * The legacy AppSidebar used `sidebarOpen` as a desktop open/close
 * flag — that sidebar has been retired in favour of the top
 * AppNavbar. We keep the same field name (so callers don't have to
 * change) but its semantics now match a **mobile drawer**: closed by
 * default on every page, opened only by the hamburger button. Desktop
 * (≥ lg) ignores it entirely — the horizontal navbar is always
 * visible there.
 */
interface ShellState {
  sidebarOpen: boolean;
  _hydrated: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  hydrate: () => void;
}

export const useShellStore = create<ShellState>((set) => ({
  /* Default closed — the navbar's mobile drawer is opt-in, not opt-out. */
  sidebarOpen: false,
  _hydrated: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  hydrate: () => set((s) => {
    if (s._hydrated) return {};
    return { sidebarOpen: false, _hydrated: true };
  }),
}));

// Hydrate on client — runs once after mount
if (typeof window !== 'undefined') {
  setTimeout(() => useShellStore.getState().hydrate(), 0);
}

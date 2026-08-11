/** Dashboard / in-app product name. */
export const BRAND_NAME = 'PowerTradeFX';

/** Zustand persist key for UI preferences (theme, terminal layout). */
export const STORAGE_KEY_UI = 'powertradefx-ui';

/** Legacy localStorage keys from earlier brand iterations. The inline
 * migration shim in `app/layout.tsx` checks each in turn on first load
 * and copies the first match into `STORAGE_KEY_UI` so existing users
 * don't lose their saved layout/theme across rebrands.
 *
 * Order: most recent → oldest. Safe to drop entries once every live
 * user has hit the app at least once on the new brand and had their
 * preferences migrated. */
export const STORAGE_KEY_UI_LEGACY_KEYS = ['novafx-ui', 'fxartha-ui'] as const;

/** @deprecated kept so existing imports compile; prefer
 *  STORAGE_KEY_UI_LEGACY_KEYS which surfaces the full chain. */
export const STORAGE_KEY_UI_LEGACY = STORAGE_KEY_UI_LEGACY_KEYS[0];

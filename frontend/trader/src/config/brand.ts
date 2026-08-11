/**
 * Brand constants — single source of truth for white-label values.
 *
 * To rebrand the entire app, swap these five strings. Everything that
 * imports from here (page titles, footer, wordmark, support links,
 * copyright) follows automatically.
 */

export const BRAND_NAME = 'PowerTradeFX';
export const BRAND_LOGO = '/images/powertradefx-logo.svg';
export const BRAND_DOMAIN = 'powertradefx.com';
export const BRAND_SUPPORT_EMAIL = 'support@powertradefx.com';
export const BRAND_COPYRIGHT = `${BRAND_NAME} © ${new Date().getFullYear()}. All rights reserved.`;

/** Zustand persist key for UI preferences (theme, terminal layout). */
export const STORAGE_KEY_UI = 'powertradefx-ui';

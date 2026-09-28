/**
 * Brand constants — single source of truth for white-label values.
 *
 * To rebrand the entire app, swap these five strings. Everything that
 * imports from here (page titles, footer, wordmark, support links,
 * copyright) follows automatically.
 */

export const BRAND_NAME = 'SwissCresta';
export const BRAND_LOGO = '/images/swisscresta-logo.svg';
export const BRAND_DOMAIN = 'swisscresta.com';
export const BRAND_SUPPORT_EMAIL = 'support@swisscresta.com';
export const BRAND_COPYRIGHT = `${BRAND_NAME} © ${new Date().getFullYear()}. All rights reserved.`;

/** Zustand persist key for UI preferences (theme, terminal layout). */
export const STORAGE_KEY_UI = 'swisscresta-ui';

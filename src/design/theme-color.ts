/**
 * The desk colour as plain values, for the one surface CSS cannot reach: the
 * browser's own chrome (Android Chrome's toolbar, Safari's tab bar), which
 * reads <meta name="theme-color"> from the root layouts' `viewport` export.
 * One per colour scheme: themeColor for day, themeColorDark for night. Both
 * must equal the matching --os-desk value in os-tokens.css; os-tokens.test.ts
 * keeps them in step.
 */
export const themeColor = '#5b7fa6';
export const themeColorDark = '#141b2b';

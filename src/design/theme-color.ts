/**
 * The page colour as a plain value, for the one surface CSS cannot reach:
 * the browser's own chrome (Android Chrome's toolbar, Safari's tab bar),
 * which reads <meta name="theme-color"> from the root layouts' `viewport`
 * export. The site has one light theme, so one value serves both OS colour
 * schemes. It must equal --color-paper in tokens.css; tokens.test.ts keeps
 * the two in step, so a new token file cannot silently leave it behind.
 */
export const themeColor = '#efede7';

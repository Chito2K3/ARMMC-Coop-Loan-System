/**
 * Flat config for ESLint 9+: delegate to Next.js' shareable config.
 * This avoids the legacy .eslintrc.json JSON import issue in Node 22+.
 */

module.exports = require('eslint-config-next');

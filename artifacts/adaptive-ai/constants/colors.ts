/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#102B3F',
    tint: '#1BA39C',

    // Core surfaces
    background: '#F7FAF9',
    foreground: '#102B3F',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#102B3F',

    // Primary action color (buttons, links, active states)
    primary: '#1BA39C',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E8F2F1',
    secondaryForeground: '#175A5A',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EEF3F2',
    mutedForeground: '#6D7F83',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#FFE9DF',
    accentForeground: '#A64E32',

    // Destructive actions (delete, error states)
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#DCE8E6',
    input: '#DCE8E6',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;

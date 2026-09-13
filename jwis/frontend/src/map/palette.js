/**
 * Map paint palette.
 *
 * MapLibre takes colour strings, not CSS classes, so every layer colour would
 * otherwise be a second copy of the design tokens living in JavaScript — and
 * the two drift. This module resolves the tokens from the document at the
 * moment a style is built, so `tokens.css` stays the only place a colour is
 * defined.
 *
 * Resolution is deliberately lazy (a function, not a module-level constant):
 * this module is evaluated while the import graph is still being walked, which
 * is before the stylesheet has been applied, so a value captured at import
 * time would be an empty string.
 */

const FALLBACK = {
  ink: "#10202b",
  ink2: "#3d4c5a",
  muted: "#5f6f7e",
  mutedSoft: "#8794a1",
  surface: "#ffffff",
  surfaceMuted: "#f7f9fb",
  surfaceSunken: "#eef1f4",
  border: "#dde3e9",
  borderStrong: "#c3ced7",
  primary: "#176b54",
  primaryHover: "#12563f",
  accentSoft: "#e8f2ee",
  accentLine: "#bcd8ce",
  danger: "#b42318",
  dangerSoft: "#fbeae8",
  warning: "#b45309",
  warningSoft: "#fdf2e4",
  success: "#176b54",
  info: "#0e6e88",
  viz1: "#176b54",
  viz2: "#0e6e88",
  viz3: "#4f7d2f",
  viz4: "#b45309",
  viz5: "#b42318",
  viz6: "#6d6f8f",
};

const TOKEN_BY_KEY = {
  ink: "--ui-ink",
  ink2: "--ui-ink-2",
  muted: "--ui-muted",
  mutedSoft: "--ui-muted-soft",
  surface: "--ui-surface",
  surfaceMuted: "--ui-surface-muted",
  surfaceSunken: "--ui-surface-sunken",
  border: "--ui-border",
  borderStrong: "--ui-border-strong",
  primary: "--ui-primary",
  primaryHover: "--ui-primary-hover",
  accentSoft: "--ui-accent-soft",
  accentLine: "--ui-accent-line",
  danger: "--ui-danger",
  dangerSoft: "--ui-danger-soft",
  warning: "--ui-warning",
  warningSoft: "--ui-warning-soft",
  success: "--ui-success",
  info: "--ui-info",
  viz1: "--ui-viz-1",
  viz2: "--ui-viz-2",
  viz3: "--ui-viz-3",
  viz4: "--ui-viz-4",
  viz5: "--ui-viz-5",
  viz6: "--ui-viz-6",
};

export function getMapColors() {
  const resolved = {};
  const root = typeof document === "undefined" ? null : document.documentElement;
  const styles = root ? getComputedStyle(root) : null;

  for (const [key, token] of Object.entries(TOKEN_BY_KEY)) {
    const value = styles ? styles.getPropertyValue(token).trim() : "";
    resolved[key] = value || FALLBACK[key];
  }

  return resolved;
}

/**
 * Popup and marker HTML is built as strings and injected into MapLibre's
 * container, so it cannot use class names from the app stylesheet. This turns
 * the same resolved tokens into an inline style block for that markup.
 */
export function getMapPopupStyles() {
  const c = getMapColors();
  return {
    ink: c.ink,
    muted: c.muted,
    border: c.border,
    surface: c.surface,
    surfaceMuted: c.surfaceMuted,
    primary: c.primary,
    danger: c.danger,
  };
}

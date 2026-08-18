/**
 * Inline transcript widgets — the few tool results that render as a panel the
 * user reads or acts on (a clarify question, an artifact card) rather than as
 * a scaffold line.
 *
 * They share one shell so they cannot drift apart. They used to each pick their
 * own: clarify sat on a 2px radius over the chat backdrop's own color (a card
 * you could only see by its hairline), the artifact card on a hardcoded 10px
 * over nothing. Square corners, one mode-derived fill, no border — the surface
 * reads as a surface on the fill alone, drawn with the same sharp edge as the
 * rest of the transcript.
 */
export const WIDGET_SHELL_CLASS = 'rounded-none bg-(--ui-widget-surface-background) px-3.5 py-3'

// Same approach as is-valid-timezone.ts: no external package, use
// ICU's own resolution via Intl.DisplayNames instead of hand-rolling
// or bundling an ISO 639-1 list. A code is treated as valid only if
// ICU resolves it to an actual language name — an unrecognized code
// is echoed back unchanged by DisplayNames rather than throwing,
// confirmed by testing (e.g. 'zz' -> 'zz', 'en' -> 'English').
const LANGUAGE_DISPLAY_NAMES = new Intl.DisplayNames(['en'], {
  type: 'language',
});

export function isValidLanguageCode(code: string): boolean {
  if (!/^[a-z]{2}$/.test(code)) return false;
  try {
    const resolved = LANGUAGE_DISPLAY_NAMES.of(code);
    return (
      resolved !== undefined && resolved.toLowerCase() !== code.toLowerCase()
    );
  } catch {
    return false;
  }
}

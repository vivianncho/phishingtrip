// Deliberate, selection-only capture. Never returns surrounding text or a URL.
(() => {
  const value = window.getSelection()?.toString().trim() || "";
  const digits = value.replace(/\D/g, "");
  return value.length <= 64 && /^\+?[\d ().-]+$/.test(value) &&
    digits.length >= 7 && digits.length <= 15 ? value : null;
})();

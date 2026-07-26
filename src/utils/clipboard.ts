// navigator.clipboard only exists in a "secure context" — HTTPS, or the
// literal hostname "localhost". Opening the dev server via its network IP
// (e.g. http://192.168.1.x:3000, printed by `next dev` as the "Network" URL)
// or any plain-HTTP address is NOT a secure context, so navigator.clipboard
// is undefined there and calling .writeText on it throws. This falls back to
// the older execCommand-based copy, which works everywhere.
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy method below
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

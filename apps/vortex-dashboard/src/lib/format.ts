/** Formatting helpers for the console. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

export function formatTime(iso: string | number | Date): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

export function formatDateTime(iso: string | number | Date): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { hour12: false });
}

export function shortId(id: string, len = 8): string {
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

/** Decode a JWT payload without verifying (display only). */
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

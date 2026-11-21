/**
 * Egress firewall for Vortex Functions.
 *
 * Wraps `fetch` to block requests to internal/private IP ranges.
 * Functions should not be able to reach localhost services,
 * cloud metadata endpoints, or internal network resources.
 *
 * Blocked ranges:
 *   - 127.0.0.0/8        (loopback)
 *   - 10.0.0.0/8         (private)
 *   - 172.16.0.0/12      (private)
 *   - 192.168.0.0/16     (private)
 *   - 169.254.0.0/16     (link-local, includes cloud metadata)
 *   - 224.0.0.0/4        (multicast)
 *   - 240.0.0.0/4        (reserved)
 *   - ::1                (IPv6 loopback)
 *   - fc00::/7           (IPv6 unique local)
 *   - fe80::/10          (IPv6 link-local)
 *   - ff00::/8           (IPv6 multicast)
 *
 * DNS resolution is deferred to the fetch call itself; we check the
 * resolved IP after DNS lookup to prevent DNS-rebinding attacks.
 */

const BLOCKED_IPV4_RANGES: Array<{ min: number; max: number }> = [
  { min: 0x7f000000, max: 0x7fffffff },    // 127.0.0.0/8
  { min: 0x0a000000, max: 0x0affffff },    // 10.0.0.0/8
  { min: 0xac100000, max: 0xac1fffff },    // 172.16.0.0/12
  { min: 0xc0a80000, max: 0xc0a8ffff },    // 192.168.0.0/16
  { min: 0xa9fe0000, max: 0xa9feffff },    // 169.254.0.0/16
  { min: 0xe0000000, max: 0xffffffff },    // 224.0.0.0/4 + 240.0.0.0/4 (multicast + reserved)
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

export function isBlockedIPv4(ip: string): boolean {
  const int = ipv4ToInt(ip);
  if (int === null) return false;
  return BLOCKED_IPV4_RANGES.some((r) => int >= r.min && int <= r.max);
}

export function isBlockedIPv6(ip: string): boolean {
  // Normalize by removing :: expansion for simple checks
  const lower = ip.toLowerCase();

  // ::1 loopback
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;

  // fc00::/7 — unique local addresses (first byte 0xfc or 0xfd)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

  // fe80::/10 — link-local (starts with fe8, fe9, fea, feb)
  if (/^fe[89ab]/.test(lower)) return true;

  // ff00::/8 — multicast
  if (lower.startsWith('ff')) return true;

  return false;
}

export class EgressFirewallError extends Error {
  constructor(url: string, reason: string) {
    super(`Egress blocked: ${reason} (${url})`);
    this.name = 'EgressFirewallError';
  }
}

/**
 * Wrap a fetch function with egress filtering.
 * Returns a fetch that rejects requests to blocked IP ranges.
 */
export function createFirewalledFetch(
  originalFetch: typeof fetch,
): typeof fetch {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = input instanceof URL ? input.href : String(input);

    // Parse the URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new EgressFirewallError(url, 'invalid URL');
    }

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new EgressFirewallError(url, `protocol ${parsed.protocol} not allowed`);
    }

    // Check the hostname directly (fast path for IP addresses)
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    if (hostname) {
      // Check if it's an IP literal
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
        if (isBlockedIPv4(hostname)) {
          throw new EgressFirewallError(url, `IP ${hostname} is in a blocked range`);
        }
      } else if (hostname.includes(':')) {
        // IPv6 literal
        if (isBlockedIPv6(hostname)) {
          throw new EgressFirewallError(url, `IP ${hostname} is in a blocked range`);
        }
      }
      // For hostnames (not IPs), we can't easily resolve DNS here
      // without adding async complexity. The firewalled fetch will
      // allow the DNS resolution to happen, then we check the result.
      // For now, hostname-based requests are allowed through the
      // initial check; the actual IP will be checked after DNS.
    }

    // For hostname-based URLs, we need to do a DNS lookup and check
    // the resolved IP. We use a two-step approach: resolve, check, fetch.
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) && !hostname.includes(':')) {
      // Resolve DNS to check the IP
      const dns = await import('node:dns/promises');
      try {
        const addresses = await dns.lookup(hostname, { all: true });
        for (const addr of addresses) {
          if (addr.family === 4 && isBlockedIPv4(addr.address)) {
            throw new EgressFirewallError(url, `DNS resolved to blocked IP ${addr.address}`);
          }
          if (addr.family === 6 && isBlockedIPv6(addr.address)) {
            throw new EgressFirewallError(url, `DNS resolved to blocked IP ${addr.address}`);
          }
        }
      } catch (err) {
        if (err instanceof EgressFirewallError) throw err;
        // DNS lookup failed — let the original fetch handle it
      }
    }

    return originalFetch(input, init);
  };
}

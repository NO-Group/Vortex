import type { NextFunction, Request, Response } from 'express';

/**
 * Comprehensive security headers middleware.
 *
 * Sets headers that prevent XSS, clickjacking, MIME sniffing,
 * protocol downgrade, and other common web vulnerabilities.
 */
export function securityHeaders() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Content Security Policy — prevent XSS by restricting resource sources
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self' https: ws: wss:",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join('; '));

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Referrer policy — don't leak URLs to third parties
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Cross-Origin Embedder Policy — restrict cross-origin resources
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    // Cross-Origin Opener Policy — prevent window references from crossing origins
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // Permissions Policy — restrict browser features
    res.setHeader('Permissions-Policy', [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'bluetooth=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', '));

    // Strict Transport Security — enforce HTTPS (set by reverse proxy in prod,
    // but we set it here as a fallback)
    if (_req.secure || _req.get('x-forwarded-proto') === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // X-XSS-Protection — legacy header for older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // X-Permitted-Cross-Domain-Policies — restrict Adobe Flash/PDF cross-domain
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // NOTE: CORS headers are intentionally NOT set here. They are handled by
    // the `cors()` middleware in app.ts, which enforces an explicit allowlist
    // (fail-closed). Setting `Access-Control-Allow-Origin: *` with
    // `Access-Control-Allow-Credentials: true` here would allow any website
    // to read authenticated cross-origin responses — a critical CORS bypass.

    // Remove server version disclosure
    res.removeHeader('X-Powered-By');

    next();
  };
}

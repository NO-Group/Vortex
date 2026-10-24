import nodemailer from 'nodemailer';
import type { ServerEnv } from '../config/env.js';

/**
 * Transactional email for auth flows (magic links, password resets).
 * When SMTP is not configured the engine runs in dev-links mode and the
 * tokens are surfaced through the API instead.
 */
export interface Mailer {
  send(to: string, subject: string, html: string): Promise<void>;
}

/** Build a nodemailer transport from SMTP_URL, or null when unconfigured. */
export function createMailer(env: ServerEnv): Mailer | null {
  if (!env.smtpUrl) return null;
  const transport = nodemailer.createTransport(env.smtpUrl);
  return {
    async send(to, subject, html) {
      await transport.sendMail({ from: env.mailFrom, to, subject, html });
    },
  };
}

/** Link back to the console — it verifies the token on load. */
export function authLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/?magic=${encodeURIComponent(token)}`;
}

const shell = (title: string, body: string, buttonLabel: string, url: string): string => `
<!doctype html><html><body style="margin:0;background:#000;padding:40px 16px;font-family:-apple-system,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#090C10;border:1px solid #161B22;border-radius:18px;padding:40px">
    <div style="width:64px;height:64px;border-radius:18px;background:conic-gradient(from 0deg,#004BFF,#A38CFF,#FFA1C5,#00D2FF,#00E6A6,#1BFF6B,#004BFF);padding:2px">
      <div style="height:100%;border-radius:16px;background:#090C10;display:flex;align-items:center;justify-content:center;font-size:28px">🌪️</div>
    </div>
    <h1 style="color:#fff;font-size:22px;letter-spacing:.04em;margin:22px 0 4px">${title}</h1>
    <p style="color:#8B949E;line-height:1.6;margin:8px 0 26px">${body}</p>
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#004BFF,#00D2FF);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 26px;border-radius:10px">
      ${buttonLabel}
    </a>
    <p style="color:#484F58;font-size:12px;line-height:1.6;margin:26px 0 0">
      This link is single-use and expires shortly. If you did not request it you can
      safely ignore this email. — Vortex by N.O Group
    </p>
  </div>
</body></html>`;

/** Branded magic sign-in email. */
export function magicLinkEmail(url: string): { subject: string; html: string } {
  return {
    subject: 'Your Vortex sign-in link',
    html: shell(
      'SIGN IN TO VORTEX',
      'Click the button below to sign in to the Vortex Console. No password needed.',
      'Open the Console →',
      url,
    ),
  };
}

/** Branded password-reset email. */
export function passwordResetEmail(url: string): { subject: string; html: string } {
  return {
    subject: 'Reset your Vortex password',
    html: shell(
      'RESET YOUR PASSWORD',
      'Click the button below to choose a new password for your Vortex account.',
      'Choose a new password →',
      url,
    ),
  };
}

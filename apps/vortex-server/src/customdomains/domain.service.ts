import type { Knex } from 'knex';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';

export interface CustomDomain {
  id: string;
  user_id: string;
  app_name: string;
  domain: string;
  status: 'pending' | 'active' | 'failed';
  verification_token: string | null;
  tls_status: string | null;
  verified_at: Date | string | null;
  created_at: Date | string;
}

export interface DnsInstructions {
  domain: string;
  type: 'CNAME';
  value: string;
  description: string;
}

export interface CustomDomainService {
  addDomain(
    userId: string,
    appName: string,
    domain: string,
  ): Promise<CustomDomain & { dnsInstructions: DnsInstructions }>;
  listDomains(userId: string, appName?: string): Promise<CustomDomain[]>;
  removeDomain(userId: string, domainId: string): Promise<boolean>;
  verifyDomain(userId: string, domainId: string): Promise<CustomDomain>;
}

export function createCustomDomainService(db: Knex): CustomDomainService {
  return {
    async addDomain(userId, appName, domain) {
      const normalized = domain.toLowerCase().trim();
      const verificationToken = crypto.randomBytes(16).toString('hex');

      const [row] = await db('vortex_custom_domains').insert({
        user_id: userId,
        app_name: appName,
        domain: normalized,
        status: 'pending',
        verification_token: verificationToken,
        tls_status: 'none',
      }).returning('*');

      const dnsInstructions: DnsInstructions = {
        domain: normalized,
        type: 'CNAME',
        value: `app.vortex.local`, // internal routing identifier
        description: `Add a CNAME record pointing ${normalized} to app.vortex.local. The domain will be verified automatically once the DNS record propagates.`,
      };

      return { ...row, dnsInstructions };
    },

    async listDomains(userId, appName) {
      const query = db('vortex_custom_domains')
        .select('*')
        .where('user_id', userId);
      if (appName) query.where('app_name', appName);
      return query.orderBy('created_at', 'desc');
    },

    async removeDomain(userId, domainId) {
      const result = await db('vortex_custom_domains')
        .where({ id: domainId, user_id: userId })
        .delete();
      return result > 0;
    },

    async verifyDomain(userId, domainId) {
      const domain = await db('vortex_custom_domains')
        .where({ id: domainId, user_id: userId })
        .first();

      if (!domain) {
        throw new Error('Domain not found');
      }

      // Check DNS CNAME record
      try {
        const records = await dns.resolveCname(domain.domain);
        // If we get here, DNS resolved — mark as verified
        await db('vortex_custom_domains')
          .where({ id: domainId })
          .update({
            status: 'active',
            tls_status: 'provisioning',
            verified_at: new Date(),
          });
      } catch {
        // DNS not resolved yet — keep as pending
        await db('vortex_custom_domains')
          .where({ id: domainId })
          .update({ tls_status: 'none' });
      }

      const updated = await db('vortex_custom_domains')
        .where({ id: domainId })
        .first();
      return updated;
    },
  };
}

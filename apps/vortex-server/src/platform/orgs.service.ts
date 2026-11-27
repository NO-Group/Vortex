import type { Knex } from 'knex';

export class OrgsService {
  constructor(private readonly db: Knex) {}

  async create(name: string, ownerId: string, slug?: string): Promise<{ id: string; name: string; slug: string; owner_id: string }> {
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const [id] = await this.db('organizations').insert({ name, slug: finalSlug, owner_id: ownerId });

    await this.db('org_members').insert({
      org_id: id,
      user_id: ownerId,
      role: 'owner',
      status: 'active',
    });

    return { id: String(id), name, slug: finalSlug, owner_id: ownerId };
  }

  async listForUser(userId: string) {
    return this.db('organizations')
      .select('o.*')
      .join('org_members', 'org_members.org_id', 'organizations.id')
      .where('org_members.user_id', userId)
      .where('org_members.status', 'active')
      .orderBy('organizations.created_at', 'desc');
  }

  async get(orgId: string) {
    return this.db('organizations').where({ id: orgId }).first();
  }

  async listMembers(orgId: string) {
    return this.db('org_members').where({ org_id: orgId }).orderBy('joined_at', 'desc');
  }

  async addMember(orgId: string, userId: string, role: 'admin' | 'member' | 'viewer' = 'member'): Promise<void> {
    await this.db('org_members').insert({
      org_id: orgId,
      user_id: userId,
      role,
      status: 'active',
    });
  }

  async updateMemberRole(orgId: string, userId: string, role: string): Promise<number> {
    return this.db('org_members')
      .where({ org_id: orgId, user_id: userId })
      .update({ role });
  }

  async removeMember(orgId: string, userId: string): Promise<number> {
    return this.db('org_members')
      .where({ org_id: orgId, user_id: userId })
      .update({ status: 'removed' });
  }

  async delete(orgId: string, ownerId: string): Promise<number> {
    const org = await this.db('organizations').where({ id: orgId, owner_id: ownerId }).first();
    if (!org) return 0;
    await this.db('org_members').where({ org_id: orgId }).del();
    return this.db('organizations').where({ id: orgId }).del();
  }
}

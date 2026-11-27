import type { Knex } from 'knex';

/**
 * ResidencyService — Data residency and compliance.
 * Enforces regional data residency policies and tracks compliance status.
 */
export class ResidencyService {
  constructor(private readonly db: Knex) {}

  async setResidency(projectId: string, region: string, compliance: string[], enforced = true) {
    await this.db('data_residency')
      .insert({ project_id: projectId, region, compliance, enforced })
      .onConflict(['project_id'])
      .merge({ region, compliance, enforced });
  }

  async getResidency(projectId: string) {
    return this.db('data_residency').where({ project_id: projectId });
  }

  async list(region?: string) {
    if (region) {
      return this.db('data_residency').where({ region });
    }
    return this.db('data_residency');
  }

  async checkCompliance(projectId: string, regulation: string): Promise<{ compliant: boolean; details: string[] }> {
    const residency = await this.db('data_residency').where({ project_id: projectId }).first();
    if (!residency) return { compliant: false, details: [`No residency policy for project ${projectId}`] };

    const compliance: string[] = residency.compliance ?? [];
    const compliant = compliance.includes(regulation) && residency.enforced;
    const details = compliant
      ? [`Project is compliant with ${regulation}`]
      : [`Project is NOT compliant with ${regulation}`];

    return { compliant, details };
  }

  async updateCompliance(projectId: string, compliance: string[]) {
    return this.db('data_residency').where({ project_id: projectId }).update({
      compliance,
      updated_at: this.db.fn.now(),
    });
  }
}

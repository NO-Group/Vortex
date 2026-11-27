import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { validateBody } from '../middleware/validate.js';

const requireAdmin = (role: string, email: string): boolean =>
  role === 'admin' || email === process.env.VORTEX_SUPER_ADMIN;

/** Mount all platform capability routes. */
export function createPlatformRoutes(ctx: AppContext): Router {
  const router = Router();
  const { db, platformRegistry, phoneAuth, passkeys, orgs, abac, docdb, procedures, backups, queue, idempotency, searchRank, notificationsExt, ai, stream, analytics, quotas, dataExport, residency, lifecycle, media, distCache, cdn, typing, tracing } = ctx;

  // ─── Platform Capability Registry ─────────────────────────────────

  router.get('/capabilities', async (req, res, next) => {
    try {
      const category = req.query.category as string | undefined;
      const caps = category ? await platformRegistry.listByCategory(category) : await platformRegistry.list();
      res.json({ capabilities: caps });
    } catch (err) { next(err); }
  });

  router.get('/capabilities/summary', async (req, res, next) => {
    try {
      res.json(await platformRegistry.summary());
    } catch (err) { next(err); }
  });

  router.post('/capabilities', validateBody(z.object({
    id: z.string(),
    category: z.string(),
    name: z.string(),
    status: z.enum(['available', 'beta', 'planned', 'experimental']),
    version: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })), async (req, res, next) => {
    try {
      if (!requireAdmin(req.auth?.role ?? '', req.auth?.email ?? '')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      const result = await platformRegistry.upsert(req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  // ─── Phone Auth ──────────────────────────────────────────────────

  router.post('/phone/request-otp', validateBody(z.object({
    phone: z.string().min(6),
  })), async (req, res, next) => {
    try {
      const result = await phoneAuth.requestOTP(req.body.phone, req.auth?.sub);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/phone/verify-otp', validateBody(z.object({
    phone: z.string().min(6),
    code: z.string().min(4).max(8),
  })), async (req, res, next) => {
    try {
      const result = await phoneAuth.verifyOTP(req.body.phone, req.body.code);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.get('/phone/otps', async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json({ otps: await phoneAuth.listForUser(userId) });
    } catch (err) { next(err); }
  });

  // ─── Passkeys ───────────────────────────────────────────────────

  router.post('/passkeys/register/challenge', async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json(passkeys.generateRegistrationChallenge());
    } catch (err) { next(err); }
  });

  router.post('/passkeys/auth/challenge', async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json(passkeys.generateAuthChallenge());
    } catch (err) { next(err); }
  });

  router.post('/passkeys/register', validateBody(z.object({
    publicKey: z.record(z.unknown()),
    credentialId: z.string(),
    transports: z.array(z.string()).optional(),
  })), async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      const result = await passkeys.register(userId, req.body.credentialId, JSON.stringify(req.body.publicKey), req.body.transports ?? []);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/passkeys/verify', validateBody(z.object({
    credentialId: z.string(),
    authenticatorData: z.string(),
    clientDataJSON: z.string(),
    signature: z.string(),
  })), async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json(await passkeys.verify(userId, req.body.credentialId, 1));
    } catch (err) { next(err); }
  });

  router.get('/passkeys', async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json({ passkeys: await passkeys.list(userId) });
    } catch (err) { next(err); }
  });

  router.delete('/passkeys/:id', async (req, res, next) => {
    try {
      await passkeys.delete(req.auth?.sub ?? '', req.params.id!);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Organizations ──────────────────────────────────────────────

  router.post('/orgs', validateBody(z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
  })), async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json(await orgs.create(req.body.name, userId, req.body.slug));
    } catch (err) { next(err); }
  });

  router.get('/orgs', async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json({ orgs: await orgs.listForUser(userId) });
    } catch (err) { next(err); }
  });

  router.get('/orgs/:id', async (req, res, next) => {
    try {
      const org = await orgs.get(req.params.id!);
      if (!org) return res.status(404).json({ error: 'not_found' });
      res.json(org);
    } catch (err) { next(err); }
  });

  router.get('/orgs/:id/members', async (req, res, next) => {
    try {
      res.json({ members: await orgs.listMembers(req.params.id!) });
    } catch (err) { next(err); }
  });

  router.post('/orgs/:id/members', validateBody(z.object({
    userId: z.string(),
    role: z.enum(['admin', 'member', 'viewer']),
  })), async (req, res, next) => {
    try {
      await orgs.addMember(req.params.id!, req.body.userId, req.body.role!);
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  });

  router.patch('/orgs/:id/members/:userId', validateBody(z.object({
    role: z.string(),
  })), async (req, res, next) => {
    try {
      res.json({ updated: await orgs.updateMemberRole(req.params.id!, req.params.userId!, req.body.role!) });
    } catch (err) { next(err); }
  });

  router.delete('/orgs/:id/members/:userId', async (req, res, next) => {
    try {
      res.json({ removed: await orgs.removeMember(req.params.id, req.params.userId!) });
    } catch (err) { next(err); }
  });

  // ─── ABAC ───────────────────────────────────────────────────────

  router.post('/abac/policies', validateBody(z.object({
    name: z.string(),
    table_name: z.string(),
    action: z.string(),
    attributes: z.record(z.unknown()),
    condition: z.record(z.unknown()),
    effect: z.enum(['allow', 'deny']),
    priority: z.number().int().default(0),
  })), async (req, res, next) => {
    try {
      if (!requireAdmin(req.auth?.role ?? '', req.auth?.email ?? '')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      res.status(201).json(await abac.create(req.body));
    } catch (err) { next(err); }
  });

  router.get('/abac/policies', async (req, res, next) => {
    try {
      res.json({ policies: await abac.list(req.query.table as string | undefined) });
    } catch (err) { next(err); }
  });

  router.patch('/abac/policies/:id', validateBody(z.record(z.unknown())), async (req, res, next) => {
    try {
      res.json({ updated: await abac.update(req.params.id!, req.body) });
    } catch (err) { next(err); }
  });

  router.delete('/abac/policies/:id', async (req, res, next) => {
    try {
      res.json({ deleted: await abac.delete(req.params.id!) });
    } catch (err) { next(err); }
  });

  router.post('/abac/evaluate', validateBody(z.object({
    table: z.string(),
    action: z.string(),
    subject: z.record(z.unknown()),
    resource: z.record(z.unknown()),
  })), async (req, res, next) => {
    try {
      const result = await abac.evaluate(req.body.table, req.body.action, req.body.subject, req.body.resource);
      res.json({ decision: result });
    } catch (err) { next(err); }
  });

  // ─── Document DB ────────────────────────────────────────────────

  router.post('/docdb/collections', validateBody(z.object({
    name: z.string().min(1),
    schema: z.record(z.unknown()).optional(),
    indexed: z.boolean().optional(),
  })), async (req, res, next) => {
    try {
      res.status(201).json(await docdb.createCollection(req.body.name, req.auth?.sub, req.body.schema, req.body.indexed ?? false));
    } catch (err) { next(err); }
  });

  router.get('/docdb/collections', async (req, res, next) => {
    try {
      res.json({ collections: await docdb.listCollections(req.auth?.sub) });
    } catch (err) { next(err); }
  });

  router.delete('/docdb/collections/:id', async (req, res, next) => {
    try {
      res.json({ deleted: await docdb.deleteCollection(req.params.id!) });
    } catch (err) { next(err); }
  });

  router.post('/docdb/collections/:id/documents', validateBody(z.object({
    data: z.record(z.unknown()),
  })), async (req, res, next) => {
    try {
      res.status(201).json(await docdb.insert(req.params.id!, req.body.data, req.auth?.sub));
    } catch (err) { next(err); }
  });

  router.get('/docdb/collections/:id/documents', async (req, res, next) => {
    try {
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      res.json({ documents: await docdb.query(req.params.id, { limit, offset }) });
    } catch (err) { next(err); }
  });

  router.get('/docdb/collections/:id/documents/:docId', async (req, res, next) => {
    try {
      const doc = await docdb.findById(req.params.id, req.params.docId!);
      if (!doc) return res.status(404).json({ error: 'not_found' });
      res.json(doc);
    } catch (err) { next(err); }
  });

  router.patch('/docdb/collections/:id/documents/:docId', validateBody(z.record(z.unknown())), async (req, res, next) => {
    try {
      res.json({ updated: await docdb.update(req.params.id!, req.params.docId!, req.body) });
    } catch (err) { next(err); }
  });

  router.delete('/docdb/collections/:id/documents/:docId', async (req, res, next) => {
    try {
      res.json({ deleted: await docdb.delete(req.params.id, req.params.docId!) });
    } catch (err) { next(err); }
  });

  // ─── Stored Procedures ──────────────────────────────────────────

  router.post('/procedures', validateBody(z.object({
    name: z.string().min(1),
    language: z.string().default('sql'),
    body: z.string().min(1),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
      mode: z.string().optional(),
    })).optional(),
  })), async (req, res, next) => {
    try {
      if (!requireAdmin(req.auth?.role ?? '', req.auth?.email ?? '')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      res.status(201).json(await procedures.create(req.body.name, req.body.body, req.body.parameters, req.body.language));
    } catch (err) { next(err); }
  });

  router.get('/procedures', async (req, res, next) => {
    try {
      res.json({ procedures: await procedures.list() });
    } catch (err) { next(err); }
  });

  router.post('/procedures/:name/execute', validateBody(z.object({
    args: z.array(z.unknown()).default([]),
  })), async (req, res, next) => {
    try {
      const result = await procedures.execute(req.params.name!, req.body.args);
      res.json({ result: await result });
    } catch (err) { next(err); }
  });

  router.delete('/procedures/:name', async (req, res, next) => {
    try {
      res.json({ deleted: await procedures.delete(req.params.name!) });
    } catch (err) { next(err); }
  });

  // ─── Backups ───────────────────────────────────────────────────

  router.post('/backups', validateBody(z.object({
    name: z.string().min(1),
    type: z.enum(['full', 'incremental', 'logical']).default('full'),
  })), async (req, res, next) => {
    try {
      if (!requireAdmin(req.auth?.role ?? '', req.auth?.email ?? '')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      const result = await backups.create(req.body.name, req.body.type, req.auth?.sub);
      // Kick off backup in background
      void backups.runBackup(String(result.id!));
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/backups', async (req, res, next) => {
    try {
      res.json({ backups: await backups.list() });
    } catch (err) { next(err); }
  });

  router.get('/backups/:id', async (req, res, next) => {
    try {
      const backup = await backups.get(req.params.id!);
      if (!backup) return res.status(404).json({ error: 'not_found' });
      res.json(backup);
    } catch (err) { next(err); }
  });

  router.post('/backups/:id/restore', async (req, res, next) => {
    try {
      if (!requireAdmin(req.auth?.role ?? '', req.auth?.email ?? '')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      await backups.restore(req.params.id!);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.delete('/backups/:id', async (req, res, next) => {
    try {
      res.json({ deleted: await backups.delete(req.params.id!) });
    } catch (err) { next(err); }
  });

  // ─── Job Queue ─────────────────────────────────────────────────

  router.post('/queue/jobs', validateBody(z.object({
    type: z.string().min(1),
    payload: z.record(z.unknown()),
    queue: z.string().optional(),
    priority: z.number().int().optional(),
    maxAttempts: z.number().int().optional(),
    runAfter: z.string().optional(),
  })), async (req, res, next) => {
    try {
      const result = await queue.enqueue(req.body.type, req.body.payload, {
        queue: req.body.queue,
        priority: req.body.priority,
        maxAttempts: req.body.maxAttempts,
        runAfter: req.body.runAfter ? new Date(req.body.runAfter) : undefined,
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/queue/jobs', async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      res.json({ jobs: await queue.list(req.query.queue as string | undefined, status) });
    } catch (err) { next(err); }
  });

  router.get('/queue/stats', async (req, res, next) => {
    try {
      res.json(await queue.stats(req.query.queue as string | undefined));
    } catch (err) { next(err); }
  });

  router.get('/queue/dlq', async (req, res, next) => {
    try {
      res.json({ deadLetters: await queue.listDLQ() });
    } catch (err) { next(err); }
  });

  router.post('/queue/dlq/:id/requeue', async (req, res, next) => {
    try {
      await queue.requeueDLQ(req.params.id!);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Idempotency ───────────────────────────────────────────────

  router.get('/idempotency', async (req, res, next) => {
    try {
      const apiKeyId = req.auth?.sub ?? '';
      res.json({ keys: await idempotency.listForKey(apiKeyId) });
    } catch (err) { next(err); }
  });

  // ─── Search Ranking ────────────────────────────────────────────

  router.post('/search/ranking', validateBody(z.object({
    index: z.string(),
    field: z.string(),
    weight: z.number(),
    boost: z.number().optional(),
  })), async (req, res, next) => {
    try {
      if (!requireAdmin(req.auth?.role ?? '', req.auth?.email ?? '')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      await searchRank.upsertRanking(req.body.index, req.body.field, req.body.weight, req.body.boost ?? 1);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/search/ranking', async (req, res, next) => {
    try {
      res.json({ rankings: await searchRank.listRankings(req.query.index as string | undefined) });
    } catch (err) { next(err); }
  });

  router.get('/search/trending', async (req, res, next) => {
    try {
      res.json({ trending: await searchRank.getTrending(req.query.index as string ?? 'default') });
    } catch (err) { next(err); }
  });

  // ─── Notifications Extended ─────────────────────────────────────

  router.post('/notifications/preferences', validateBody(z.object({
    channel: z.enum(['in_app', 'push', 'email', 'sms', 'webhook']),
    eventType: z.string(),
    enabled: z.boolean(),
  })), async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      await notificationsExt.setPreference(userId, req.body.channel, req.body.eventType, req.body.enabled);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/notifications/preferences', async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json({ preferences: await notificationsExt.listPreferences(userId, req.query.channel as string | undefined) });
    } catch (err) { next(err); }
  });

  router.post('/notifications/enqueue', validateBody(z.object({
    eventType: z.string(),
    payload: z.record(z.unknown()),
    priority: z.number().int().optional(),
  })), async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.status(201).json(await notificationsExt.enqueue(userId, req.body.eventType, req.body.payload, req.body.priority ?? 5));
    } catch (err) { next(err); }
  });

  router.get('/notifications/queue', async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json({ notifications: await notificationsExt.list(userId, req.query.status as string | undefined) });
    } catch (err) { next(err); }
  });

  // ─── AI: Moderation, Tags, Recommendations ─────────────────────

  router.post('/ai/moderation/submit', validateBody(z.object({
    contentType: z.string(),
    contentId: z.string(),
    content: z.string(),
  })), async (req, res, next) => {
    try {
      res.status(201).json(await ai.submitModeration(req.body.contentType, req.body.contentId, req.body.content, req.auth?.sub));
    } catch (err) { next(err); }
  });

  router.get('/ai/moderation', async (req, res, next) => {
    try {
      res.json({ items: await ai.listModeration(req.query.status as string | undefined) });
    } catch (err) { next(err); }
  });

  router.post('/ai/moderation/:id/review', validateBody(z.object({
    verdict: z.enum(['approved', 'flagged', 'rejected']),
    reason: z.string().optional(),
  })), async (req, res, next) => {
    try {
      res.json({ updated: await ai.reviewModeration(req.params.id!, req.body.verdict, req.body.reason!) });
    } catch (err) { next(err); }
  });

  router.post('/ai/tags', validateBody(z.object({
    contentType: z.string(),
    contentId: z.string(),
    tags: z.array(z.string()),
  })), async (req, res, next) => {
    try {
      await ai.tag(req.body.contentType, req.body.contentId, req.body.tags);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/ai/tags', async (req, res, next) => {
    try {
      res.json({ tags: await ai.getTags(req.query.contentType as string, req.query.contentId as string) });
    } catch (err) { next(err); }
  });

  router.post('/ai/interactions', validateBody(z.object({
    contentType: z.string(),
    contentId: z.string(),
    interaction: z.enum(['view', 'like', 'share', 'comment']),
  })), async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      await ai.recordInteraction(userId, req.body.contentType, req.body.contentId, req.body.interaction);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/ai/recommendations', async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json({ recommendations: await ai.getRecommendations(userId, req.query.contentType as string) });
    } catch (err) { next(err); }
  });

  // ─── Streaming ──────────────────────────────────────────────────

  router.post('/stream/sessions', validateBody(z.object({
    type: z.enum(['webrtc', 'rtmp', 'hls']),
    room: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })), async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.status(201).json(await stream.createSession(req.body.type, req.body.room ?? null, userId, req.body.metadata ?? {}));
    } catch (err) { next(err); }
  });

  router.get('/stream/sessions', async (req, res, next) => {
    try {
      res.json({ sessions: await stream.listActive(req.query.type as string | undefined, req.query.room as string | undefined) });
    } catch (err) { next(err); }
  });

  router.get('/stream/sessions/:id', async (req, res, next) => {
    try {
      const session = await stream.getSession(req.params.id!);
      if (!session) return res.status(404).json({ error: 'not_found' });
      res.json(session);
    } catch (err) { next(err); }
  });

  router.post('/stream/sessions/:id/join', async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json(await stream.addParticipant(req.params.id, userId));
    } catch (err) { next(err); }
  });

  router.post('/stream/sessions/:id/leave', async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      await stream.removeParticipant(req.params.id, userId);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.post('/stream/sessions/:id/end', validateBody(z.object({
    reason: z.string().optional(),
  }).partial()), async (req, res, next) => {
    try {
      await stream.endSession(req.params.id!, req.body.reason!);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/stream/stats', async (req, res, next) => {
    try {
      res.json(await stream.stats());
    } catch (err) { next(err); }
  });

  // ─── Analytics ──────────────────────────────────────────────────

  router.post('/analytics/track', validateBody(z.object({
    eventType: z.string(),
    eventName: z.string(),
    metadata: z.record(z.unknown()).optional(),
  })), async (req, res, next) => {
    try {
      const userId = req.auth?.sub ?? null;
      await analytics.track(req.body.eventType, req.body.eventName, userId, req.body.metadata ?? {});
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/analytics/events', async (req, res, next) => {
    try {
      res.json({
        events: await analytics.queryEvents({
          eventType: req.query.eventType as string | undefined,
          eventName: req.query.eventName as string | undefined,
          userId: req.query.userId as string | undefined,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
          offset: req.query.offset ? Number(req.query.offset) : undefined,
        }),
      });
    } catch (err) { next(err); }
  });

  router.get('/analytics/stats', async (req, res, next) => {
    try {
      const eventType = req.query.eventType as string;
      if (!eventType) return res.status(400).json({ error: 'eventType required' });
      res.json({ stats: await analytics.eventStats(eventType) });
    } catch (err) { next(err); }
  });

  router.get('/analytics/api-usage', async (req, res, next) => {
    try {
      res.json(await analytics.apiUsageStats(req.query.apiKeyId as string | undefined));
    } catch (err) { next(err); }
  });

  // ─── Quotas ─────────────────────────────────────────────────────

  router.post('/quotas', validateBody(z.object({
    projectId: z.string(),
    resource: z.string(),
    limit: z.number(),
    period: z.enum(['hour', 'day', 'month']).default('month'),
  })), async (req, res, next) => {
    try {
      if (!requireAdmin(req.auth?.role ?? '', req.auth?.email ?? '')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      await quotas.setQuota(req.body.projectId, req.body.resource, req.body.limit, req.body.period);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/quotas', async (req, res, next) => {
    try {
      res.json({ quotas: await quotas.list(req.query.projectId as string ?? '') });
    } catch (err) { next(err); }
  });

  router.get('/quotas/check', async (req, res, next) => {
    try {
      const projectId = req.query.projectId as string;
      const resource = req.query.resource as string;
      if (!projectId || !resource) return res.status(400).json({ error: 'projectId and resource required' });
      res.json(await quotas.checkQuota(projectId, resource));
    } catch (err) { next(err); }
  });

  router.post('/quotas/usage', validateBody(z.object({
    projectId: z.string(),
    resource: z.string(),
    amount: z.number().int().default(1),
  })), async (req, res, next) => {
    try {
      await quotas.recordUsage(req.body.projectId, req.body.resource, req.body.amount);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Data Export ────────────────────────────────────────────────

  router.post('/data-exports', validateBody(z.object({
    name: z.string().min(1),
    format: z.enum(['json', 'csv', 'sql', 'parquet']),
    tables: z.array(z.string()).min(1),
    projectId: z.string().optional(),
  })), async (req, res, next) => {
    try {
      const result = await dataExport.create(req.body.name, req.body.format, req.body.tables, req.body.projectId);
      void dataExport.run(String(result.id!));
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/data-exports', async (req, res, next) => {
    try {
      res.json({ exports: await dataExport.list() });
    } catch (err) { next(err); }
  });

  router.get('/data-exports/:id', async (req, res, next) => {
    try {
      const exp = await dataExport.get(req.params.id!);
      if (!exp) return res.status(404).json({ error: 'not_found' });
      res.json(exp);
    } catch (err) { next(err); }
  });

  router.delete('/data-exports/:id', async (req, res, next) => {
    try {
      res.json({ deleted: await dataExport.delete(req.params.id!) });
    } catch (err) { next(err); }
  });

  // ─── Data Residency ─────────────────────────────────────────────

  router.post('/data-residency', validateBody(z.object({
    projectId: z.string(),
    region: z.string(),
    compliance: z.array(z.string()),
    enforced: z.boolean().default(true),
  })), async (req, res, next) => {
    try {
      if (!requireAdmin(req.auth?.role ?? '', req.auth?.email ?? '')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      await residency.setResidency(req.body.projectId, req.body.region, req.body.compliance, req.body.enforced);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/data-residency', async (req, res, next) => {
    try {
      res.json({ residency: await residency.list(req.query.region as string | undefined) });
    } catch (err) { next(err); }
  });

  router.get('/data-residency/:projectId', async (req, res, next) => {
    try {
      res.json({ residency: await residency.getResidency(req.params.projectId) });
    } catch (err) { next(err); }
  });

  router.get('/data-residency/:projectId/compliance/:regulation', async (req, res, next) => {
    try {
      res.json(await residency.checkCompliance(req.params.projectId, req.params.regulation));
    } catch (err) { next(err); }
  });

  // ─── Lifecycle ──────────────────────────────────────────────────

  router.post('/lifecycle/policies', validateBody(z.object({
    resource: z.string(),
    action: z.enum(['retain', 'archive', 'delete', 'tier']),
    conditions: z.record(z.unknown()),
    enabled: z.boolean().default(true),
  })), async (req, res, next) => {
    try {
      if (!requireAdmin(req.auth?.role ?? '', req.auth?.email ?? '')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      res.status(201).json(await lifecycle.create(req.body));
    } catch (err) { next(err); }
  });

  router.get('/lifecycle/policies', async (req, res, next) => {
    try {
      res.json({ policies: await lifecycle.list(req.query.resource as string | undefined) });
    } catch (err) { next(err); }
  });

  router.patch('/lifecycle/policies/:id', validateBody(z.record(z.unknown())), async (req, res, next) => {
    try {
      res.json({ updated: await lifecycle.update(req.params.id!, req.body) });
    } catch (err) { next(err); }
  });

  router.delete('/lifecycle/policies/:id', async (req, res, next) => {
    try {
      res.json({ deleted: await lifecycle.delete(req.params.id!) });
    } catch (err) { next(err); }
  });

  // ─── Media Jobs ─────────────────────────────────────────────────

  router.post('/media/jobs', validateBody(z.object({
    type: z.enum(['image', 'video', 'audio']),
    operation: z.enum(['thumbnail', 'transcode', 'extract_audio', 'compress', 'resize', 'watermark']),
    sourceUrl: z.string(),
    options: z.record(z.unknown()).optional(),
  })), async (req, res, next) => {
    try {
      res.status(201).json(await media.createJob(req.body.type, req.body.operation, req.body.sourceUrl, req.body.options ?? {}, req.auth?.sub));
    } catch (err) { next(err); }
  });

  router.get('/media/jobs', async (req, res, next) => {
    try {
      res.json({ jobs: await media.list(req.query.status as string | undefined) });
    } catch (err) { next(err); }
  });

  router.get('/media/jobs/:id', async (req, res, next) => {
    try {
      const job = await media.getJob(req.params.id!);
      if (!job) return res.status(404).json({ error: 'not_found' });
      res.json(job);
    } catch (err) { next(err); }
  });

  router.get('/media/stats', async (req, res, next) => {
    try {
      res.json(await media.stats());
    } catch (err) { next(err); }
  });

  router.delete('/media/jobs/:id', async (req, res, next) => {
    try {
      res.json({ deleted: await media.delete(req.params.id!) });
    } catch (err) { next(err); }
  });

  // ─── Distributed Cache ──────────────────────────────────────────

  router.get('/cache/:key', async (req, res, next) => {
    try {
      const value = await distCache.get(req.params.key, req.query.namespace as string | undefined);
      if (value === null) return res.status(404).json({ error: 'not_found' });
      res.json({ value });
    } catch (err) { next(err); }
  });

  router.post('/cache', validateBody(z.object({
    key: z.string(),
    value: z.unknown(),
    ttl: z.number().int().optional(),
    namespace: z.string().optional(),
  })), async (req, res, next) => {
    try {
      await distCache.set(req.body.key, req.body.value, req.body.ttl, req.body.namespace);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.delete('/cache/:key', async (req, res, next) => {
    try {
      res.json({ deleted: await distCache.delete(req.params.key) });
    } catch (err) { next(err); }
  });

  router.get('/cache/stats', async (req, res, next) => {
    try {
      res.json(await distCache.stats(req.query.namespace as string | undefined));
    } catch (err) { next(err); }
  });

  // ─── CDN ───────────────────────────────────────────────────────

  router.post('/cdn/configs', validateBody(z.object({
    name: z.string().min(1),
    provider: z.string(),
    origin: z.string(),
    cacheTtl: z.number().int().optional(),
    enabled: z.boolean().optional(),
    rules: z.record(z.unknown()).optional(),
  })), async (req, res, next) => {
    try {
      if (!requireAdmin(req.auth?.role ?? '', req.auth?.email ?? '')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      res.status(201).json(await cdn.create(req.body));
    } catch (err) { next(err); }
  });

  router.get('/cdn/configs', async (req, res, next) => {
    try {
      res.json({ configs: await cdn.list(req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined) });
    } catch (err) { next(err); }
  });

  router.get('/cdn/stats', async (req, res, next) => {
    try {
      res.json(await cdn.stats());
    } catch (err) { next(err); }
  });

  router.delete('/cdn/configs/:id', async (req, res, next) => {
    try {
      res.json({ deleted: await cdn.delete(req.params.id!) });
    } catch (err) { next(err); }
  });

  // ─── Typing Indicators ──────────────────────────────────────────

  router.post('/typing', validateBody(z.object({
    room: z.string(),
    isTyping: z.boolean(),
  })), async (req, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      await typing.setTyping(userId, req.body.room, req.body.isTyping);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/typing/:room', async (req, res, next) => {
    try {
      res.json({ users: await typing.getTypingUsers(req.params.room) });
    } catch (err) { next(err); }
  });

  // ─── Tracing ───────────────────────────────────────────────────

  router.post('/tracing/traces', validateBody(z.object({
    service: z.string(),
    operation: z.string(),
    attributes: z.record(z.unknown()).optional(),
  })), async (req, res, next) => {
    try {
      res.status(201).json(await tracing.startTrace(req.body.service, req.body.operation, req.body.attributes ?? {}));
    } catch (err) { next(err); }
  });

  router.get('/tracing/traces', async (req, res, next) => {
    try {
      res.json({
        traces: await tracing.listTraces({
          service: req.query.service as string | undefined,
          status: req.query.status as string | undefined,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
        }),
      });
    } catch (err) { next(err); }
  });

  router.get('/tracing/traces/:traceId', async (req, res, next) => {
    try {
      const trace = await tracing.getTrace(req.params.traceId);
      if (!trace || trace.length === 0) return res.status(404).json({ error: 'not_found' });
      res.json({ trace });
    } catch (err) { next(err); }
  });

  router.get('/tracing/stats', async (req, res, next) => {
    try {
      res.json(await tracing.stats());
    } catch (err) { next(err); }
  });

  return router;
}

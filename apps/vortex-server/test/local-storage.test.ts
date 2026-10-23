import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalStorageDriver } from '../src/storage/local.driver.js';
import { ApiError } from '../src/errors.js';

describe('LocalStorageDriver', () => {
  let dir: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vortex-test-'));
    driver = new LocalStorageDriver(dir, 'test-secret', 'http://localhost:8080');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('stores and retrieves objects', async () => {
    await driver.put({ key: 'docs/hello.txt', body: Buffer.from('hi vortex'), contentType: 'text/plain' });
    const got = await driver.get('docs/hello.txt');
    expect(got.body.toString()).toBe('hi vortex');
    expect(await driver.exists('docs/hello.txt')).toBe(true);
    expect(await driver.exists('docs/missing.txt')).toBe(false);
  });

  it('lists objects by prefix', async () => {
    await driver.put({ key: 'a/1.txt', body: Buffer.from('1') });
    await driver.put({ key: 'a/2.txt', body: Buffer.from('2') });
    await driver.put({ key: 'b/3.txt', body: Buffer.from('3') });

    const keys = await driver.list('a/', 100);
    expect(keys).toEqual(['a/1.txt', 'a/2.txt']);
  });

  it('deletes objects', async () => {
    await driver.put({ key: 'gone.txt', body: Buffer.from('x') });
    await driver.delete('gone.txt');
    expect(await driver.exists('gone.txt')).toBe(false);
  });

  it('blocks path traversal in keys', async () => {
    await expect(driver.put({ key: '../escape.txt', body: Buffer.from('x') })).rejects.toThrow(ApiError);
    await expect(driver.get('../../etc/passwd')).rejects.toThrow(ApiError);
  });

  it('round-trips a presigned upload token', async () => {
    const presigned = await driver.presignUpload({ key: 'uploads/file.bin', contentType: 'application/json' });
    expect(presigned.method).toBe('PUT');
    expect(presigned.url).toContain('/v1/storage/local/upload?token=');

    const token = decodeURIComponent(presigned.url.split('token=')[1]!);
    const payload = driver.verifySigned(token);
    expect(payload.op).toBe('put');
    expect(payload.key).toBe('uploads/file.bin');
    expect(payload.contentType).toBe('application/json');
  });

  it('honors a per-request base URL override (PUBLIC_API_BASE=auto)', async () => {
    const presigned = await driver.presignUpload({ key: 'a.txt' }, 'https://console.example.com');
    expect(presigned.url.startsWith('https://console.example.com/v1/storage/local/upload?token=')).toBe(true);
  });

  it('rejects tampered tokens', async () => {
    const presigned = await driver.presignDownload('private.txt', 60);
    const token = decodeURIComponent(presigned.url.split('token=')[1]!);
    expect(() => driver.verifySigned(token + 'x')).toThrow(ApiError);
    expect(() => driver.verifySigned('garbage')).toThrow(ApiError);
  });

  it('rejects expired tokens', async () => {
    const presigned = await driver.presignDownload('private.txt', 1);
    const token = decodeURIComponent(presigned.url.split('token=')[1]!);
    // Expire by rewinding clock via a token crafted in the past.
    const payload = driver.verifySigned(token); // still valid within 1s window
    expect(payload.op).toBe('get');
    await new Promise((r) => setTimeout(r, 1100));
    expect(() => driver.verifySigned(token)).toThrow(/expired/);
  });
});

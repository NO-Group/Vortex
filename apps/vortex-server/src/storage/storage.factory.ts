import type { DriverConfig, IVortexStorageDriver, ProviderType } from './driver.interface.js';
import { R2Driver } from './drivers/r2.driver.js';
import { AWSS3Driver } from './drivers/aws-s3.driver.js';
import { DigitalOceanSpacesDriver } from './drivers/digitalocean-spaces.driver.js';
import { GCSDriver } from './drivers/gcs.driver.js';
import { AzureBlobDriver } from './drivers/azure-blob.driver.js';
import { LocalDiskDriver } from './drivers/local-disk.driver.js';

/**
 * Storage driver factory — creates the correct driver based on provider type.
 * This is the entry point for the multi-cloud storage engine.
 */
export function createStorageDriver(config: DriverConfig): IVortexStorageDriver {
  switch (config.type) {
    case 'cloudflare_r2':
      return new R2Driver(config);
    case 'aws_s3':
      return new AWSS3Driver(config);
    case 'digitalocean_spaces':
      return new DigitalOceanSpacesDriver(config);
    case 'gcs':
      return new GCSDriver(config);
    case 'azure_blob':
      return new AzureBlobDriver(config);
    case 'local_disk':
      return new LocalDiskDriver(config);
    default:
      throw new Error(`Unknown storage provider: ${config.type}`);
  }
}

/**
 * Create a driver from environment variables.
 */
export function createDriverFromEnv(env: Record<string, string | undefined>): IVortexStorageDriver {
  const provider = (env.STORAGE_PROVIDER ?? 'local_disk') as ProviderType;

  const config: DriverConfig = {
    type: provider,
    bucket: env.STORAGE_BUCKET ?? 'vortex',
    region: env.STORAGE_REGION ?? undefined,
    endpoint: env.STORAGE_ENDPOINT || undefined,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID || undefined,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY || undefined,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === 'true',
    localDir: env.STORAGE_LOCAL_DIR ?? './vortex_data/storage/',
    accountId: env.CLOUDFLARE_ACCOUNT_ID || undefined,
    projectId: env.GCS_PROJECT_ID || undefined,
    connectionString: env.AZURE_CONNECTION_STRING || undefined,
  };

  return createStorageDriver(config);
}

/**
 * List all available provider types.
 */
export const AVAILABLE_PROVIDERS: ProviderType[] = [
  'cloudflare_r2',
  'aws_s3',
  'digitalocean_spaces',
  'gcs',
  'azure_blob',
  'local_disk',
];

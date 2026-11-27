<?php

namespace NoGroup\Vortex;

use GuzzleHttp\Exception\GuzzleException;

class StorageService
{
    public function __construct(private VortexClient $client) {}

    /** @throws GuzzleException */
    public function createBucket(string $name, bool $isPublic = false): array
    {
        return $this->client->request('POST', '/v1/storage/buckets', ['name' => $name, 'isPublic' => $isPublic]);
    }

    /** @throws GuzzleException */
    public function listBuckets(): array
    {
        return $this->client->request('GET', '/v1/storage/buckets');
    }

    /** @throws GuzzleException */
    public function presignUpload(string $path): array
    {
        return $this->client->request('POST', '/v1/storage/presign-upload', ['path' => $path]);
    }

    public function imageUrl(string $bucket, string $path, array $opts = []): string
    {
        $url = $this->client->baseUrl() . '/v1/storage/public/' . $bucket . '/' . $path;
        if (!empty($opts)) {
            $url .= '?' . http_build_query($opts);
        }
        return $url;
    }
}

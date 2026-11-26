<?php

namespace NoGroup\Vortex;

use GuzzleHttp\Exception\GuzzleException;

class AppsService
{
    public function __construct(private VortexClient $client) {}

    /** @throws GuzzleException */
    public function create(string $name, string $title, string $description = ''): array
    {
        return $this->client->request('POST', '/v1/apps', [
            'name' => $name,
            'title' => $title,
            'description' => $description,
        ]);
    }

    /** @throws GuzzleException */
    public function list(): array
    {
        return $this->client->request('GET', '/v1/apps');
    }

    /** @throws GuzzleException */
    public function get(string $id): array
    {
        return $this->client->request('GET', '/v1/apps/' . $id);
    }

    /** @throws GuzzleException */
    public function delete(string $id): void
    {
        $this->client->request('DELETE', '/v1/apps/' . $id);
    }
}

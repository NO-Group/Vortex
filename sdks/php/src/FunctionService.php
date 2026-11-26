<?php

namespace NoGroup\Vortex;

use GuzzleHttp\Exception\GuzzleException;

class FunctionService
{
    public function __construct(private VortexClient $client) {}

    /** @throws GuzzleException */
    public function deploy(string $name, string $language, string $code, string $description = ''): array
    {
        return $this->client->request('POST', '/v1/functions', [
            'name' => $name,
            'language' => $language,
            'code' => $code,
            'description' => $description,
        ]);
    }

    /** @throws GuzzleException */
    public function list(): array
    {
        return $this->client->request('GET', '/v1/functions');
    }

    /** @throws GuzzleException */
    public function invoke(string $name, array $data): array
    {
        return $this->client->request('POST', '/functions/' . $name, $data);
    }

    /** @throws GuzzleException */
    public function get(string $name): array
    {
        return $this->client->request('GET', '/v1/functions/' . $name);
    }

    /** @throws GuzzleException */
    public function delete(string $name): void
    {
        $this->client->request('DELETE', '/v1/functions/' . $name);
    }
}

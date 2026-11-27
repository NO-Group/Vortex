<?php

namespace NoGroup\Vortex;

use GuzzleHttp\Exception\GuzzleException;

class AdminService
{
    public function __construct(private VortexClient $client) {}

    /** @throws GuzzleException */
    public function sql(string $statement): array
    {
        return $this->client->request('POST', '/v1/sql', ['sql' => $statement]);
    }

    /** @throws GuzzleException */
    public function listPolicies(): array
    {
        return $this->client->request('GET', '/v1/policies');
    }

    /** @throws GuzzleException */
    public function createPolicy(string $table, array $policy): array
    {
        return $this->client->request('POST', '/v1/policies', ['table' => $table, 'policy' => $policy]);
    }

    /** @throws GuzzleException */
    public function listUsers(): array
    {
        return $this->client->request('GET', '/v1/auth/users');
    }

    /** @throws GuzzleException */
    public function insightsOverview(): array
    {
        return $this->client->request('GET', '/v1/insights/overview');
    }
}

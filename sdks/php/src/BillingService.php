<?php

namespace NoGroup\Vortex;

use GuzzleHttp\Exception\GuzzleException;

class BillingService
{
    public function __construct(private VortexClient $client) {}

    /** @throws GuzzleException */
    public function status(): array
    {
        return $this->client->request('GET', '/v1/billing/status');
    }

    /** @throws GuzzleException */
    public function listPlans(): array
    {
        return $this->client->request('GET', '/v1/billing/plans');
    }

    /** @throws GuzzleException */
    public function checkout(string $planName, string $email, ?string $successUrl = null, ?string $cancelUrl = null): array
    {
        $body = ['planName' => $planName, 'email' => $email];
        if ($successUrl !== null) $body['successUrl'] = $successUrl;
        if ($cancelUrl !== null) $body['cancelUrl'] = $cancelUrl;
        return $this->client->request('POST', '/v1/billing/checkout', $body);
    }

    /** @throws GuzzleException */
    public function listTransactions(int $limit = 50): array
    {
        return $this->client->request('GET', '/v1/billing/transactions', null, ['limit' => $limit]);
    }

    /** @throws GuzzleException */
    public function getSubscription(): array
    {
        return $this->client->request('GET', '/v1/billing/subscription');
    }

    /** @throws GuzzleException */
    public function cancelSubscription(): array
    {
        return $this->client->request('POST', '/v1/billing/subscription/cancel');
    }

    /** @throws GuzzleException */
    public function getMe(): array
    {
        return $this->client->request('GET', '/v1/billing/me');
    }
}

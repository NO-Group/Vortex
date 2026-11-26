<?php

namespace NoGroup\Vortex;

use GuzzleHttp\Exception\GuzzleException;

class AuthService
{
    public function __construct(private VortexClient $client) {}

    /** @throws GuzzleException */
    public function signup(string $email, string $password, ?array $metadata = null): array
    {
        $body = ['email' => $email, 'password' => $password];
        if ($metadata !== null) $body['metadata'] = $metadata;
        $session = $this->client->request('POST', '/v1/auth/signup', $body);
        $this->client->setToken($session['token']);
        return $session;
    }

    /** @throws GuzzleException */
    public function login(string $email, string $password): array
    {
        $session = $this->client->request('POST', '/v1/auth/login', ['email' => $email, 'password' => $password]);
        $this->client->setToken($session['token']);
        return $session;
    }

    /** @throws GuzzleException */
    public function me(): array
    {
        return $this->client->request('GET', '/v1/auth/me');
    }

    /** @throws GuzzleException */
    public function listOAuthProviders(): array
    {
        return $this->client->request('GET', '/v1/auth/oauth/providers');
    }

    /** @throws GuzzleException */
    public function registerDevice(string $token, string $platform, ?string $pushService = null): array
    {
        $body = ['token' => $token, 'platform' => $platform];
        if ($pushService !== null) $body['pushService'] = $pushService;
        return $this->client->request('POST', '/v1/notifications/devices', $body);
    }

    /** @throws GuzzleException */
    public function sendNotification(string $title, string $body, ?array $data = null): array
    {
        $payload = ['title' => $title, 'body' => $body];
        if ($data !== null) $payload['data'] = $data;
        return $this->client->request('POST', '/v1/notifications', $payload);
    }
}

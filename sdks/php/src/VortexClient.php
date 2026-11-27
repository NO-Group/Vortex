<?php

namespace NoGroup\Vortex;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

/**
 * Vortex BaaS PHP SDK.
 *
 * ```php
 * $vortex = new VortexClient('https://your-vortex.example.com');
 * $session = $vortex->auth()->signup('user@example.com', 'password');
 * $notes = $vortex->database()->from('notes')->filter('owner_id', 'eq', $session['user']['id'])->limit(10)->execute();
 * ```
 */
class VortexClient
{
    private string $baseUrl;
    private ?string $token = null;
    private Client $http;

    public function __construct(string $baseUrl, ?Client $http = null)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->http = $http ?? new Client(['timeout' => 30]);
    }

    public function setToken(string $token): void
    {
        $this->token = $token;
    }

    public function getToken(): ?string
    {
        return $this->token;
    }

    public function baseUrl(): string
    {
        return $this->baseUrl;
    }

    /**
     * @throws GuzzleException
     */
    private function request(string $method, string $path, ?array $body = null, ?array $query = null): array
    {
        $headers = ['Accept' => 'application/json'];
        if ($body !== null) {
            $headers['Content-Type'] = 'application/json';
        }
        if ($this->token) {
            $headers['Authorization'] = 'Bearer ' . $this->token;
        }

        $url = $this->baseUrl . $path;
        if ($query) {
            $url .= '?' . http_build_query($query);
        }

        $response = $this->http->request($method, $url, [
            'headers' => $headers,
            'body' => $body !== null ? json_encode($body) : null,
        ]);

        $data = json_decode($response->getBody()->getContents(), true);

        if ($response->getStatusCode() >= 400) {
            $error = $data['error'] ?? ['code' => 'error', 'message' => 'Request failed'];
            throw new VortexException($response->getStatusCode(), $error['code'], $error['message']);
        }

        return $data;
    }

    public function auth(): AuthService
    {
        return new AuthService($this);
    }

    public function database(): DatabaseService
    {
        return new DatabaseService($this);
    }

    public function storage(): StorageService
    {
        return new StorageService($this);
    }

    public function functions(): FunctionService
    {
        return new FunctionService($this);
    }

    public function apps(): AppsService
    {
        return new AppsService($this);
    }

    public function billing(): BillingService
    {
        return new BillingService($this);
    }

    public function admin(): AdminService
    {
        return new AdminService($this);
    }
}

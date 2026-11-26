<?php

namespace NoGroup\Vortex;

use GuzzleHttp\Exception\GuzzleException;

class DatabaseService
{
    public function __construct(private VortexClient $client) {}

    public function from(string $table): QueryBuilder
    {
        return new QueryBuilder($this->client, $table);
    }

    /** @throws GuzzleException */
    public function insert(string $table, array $rows): array
    {
        return $this->client->request('POST', "/v1/db/$table", ['rows' => $rows]);
    }

    /** @throws GuzzleException */
    public function listTables(): array
    {
        return $this->client->request('GET', '/v1/db/tables');
    }
}

class QueryBuilder
{
    private array $filters = [];
    private ?int $limit = null;
    private ?int $offset = null;
    private array $orderBy = [];
    private bool $countTotal = false;
    private ?array $select = null;

    public function __construct(private VortexClient $client, private string $table) {}

    public function select(array $cols): self { $this->select = $cols; return $this; }
    public function filter(string $column, string $op, $value): self
    {
        $this->filters[] = ['column' => $column, 'op' => $op, 'value' => $value];
        return $this;
    }
    public function limit(int $n): self { $this->limit = $n; return $this; }
    public function offset(int $n): self { $this->offset = $n; return $this; }
    public function orderBy(string $column, string $direction = 'asc'): self
    {
        $this->orderBy[] = ['column' => $column, 'direction' => $direction];
        return $this;
    }
    public function countTotal(): self { $this->countTotal = true; return $this; }

    /** @throws GuzzleException */
    public function execute(): array
    {
        $body = ['filters' => $this->filters];
        if ($this->countTotal) $body['countTotal'] = true;
        if ($this->select !== null) $body['select'] = $this->select;
        if ($this->limit !== null) $body['limit'] = $this->limit;
        if ($this->offset !== null) $body['offset'] = $this->offset;
        if (!empty($this->orderBy)) $body['orderBy'] = $this->orderBy;

        return $this->client->request('POST', "/v1/db/{$this->table}/query", $body);
    }
}

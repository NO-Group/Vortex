from .client import VortexClient


class QueryBuilder:
    def __init__(self, client: VortexClient, table: str):
        self._c = client
        self._table = table
        self._filters: list[dict] = []
        self._limit: int | None = None
        self._offset: int | None = None
        self._order_by: list[dict] = []
        self._count_total = False
        self._select: list[str] | None = None

    def select(self, cols: list[str]) -> "QueryBuilder":
        self._select = cols
        return self

    def filter(self, column: str, op: str, value) -> "QueryBuilder":
        self._filters.append({"column": column, "op": op, "value": value})
        return self

    def limit(self, n: int) -> "QueryBuilder":
        self._limit = n
        return self

    def offset(self, n: int) -> "QueryBuilder":
        self._offset = n
        return self

    def order_by(self, column: str, direction: str = "asc") -> "QueryBuilder":
        self._order_by.append({"column": column, "direction": direction})
        return self

    def count_total(self) -> "QueryBuilder":
        self._count_total = True
        return self

    async def execute(self) -> dict:
        body: dict = {"filters": self._filters, "countTotal": self._count_total}
        if self._select: body["select"] = self._select
        if self._limit is not None: body["limit"] = self._limit
        if self._offset is not None: body["offset"] = self._offset
        if self._order_by: body["orderBy"] = self._order_by
        return await self._c._request("POST", f"/v1/db/{self._table}/query", json=body)


class Database:
    def __init__(self, client: VortexClient):
        self._c = client

    def from_table(self, table: str) -> QueryBuilder:
        return QueryBuilder(self._c, table)

    async def insert(self, table: str, rows: list[dict]) -> dict:
        return await self._c._request("POST", f"/v1/db/{table}", json={"rows": rows})

    async def update(self, table: str, updates: dict, filters: list[dict]) -> dict:
        return await self._c._request("PATCH", f"/v1/db/{table}", json={"updates": updates, "filters": filters})

    async def delete(self, table: str, filters: list[dict]) -> dict:
        return await self._c._request("DELETE", f"/v1/db/{table}", json={"filters": filters})

    async def list_tables(self) -> list[str]:
        return (await self._c._request("GET", "/v1/db/tables")).get("tables", [])

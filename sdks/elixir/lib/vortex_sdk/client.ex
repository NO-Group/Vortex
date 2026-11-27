defmodule VortexSDK.Client do
  @moduledoc """
  Main Vortex client.
  """

  defstruct base_url: "", token: nil, http: nil

  def new(base_url) do
    base_url = String.trim_trailing(base_url, "/")
    {:ok, %__MODULE__{base_url: base_url, http: Http.new(base_url)}}
  end

  def set_token(%__MODULE__{} = client, token) do
    %{client | token: token}
  end

  def auth(%__MODULE__{} = client), do: %Auth{client: client}
  def database(%__MODULE__{} = client), do: %Database{client: client}
  def storage(%__MODULE__{} = client), do: %Storage{client: client}
  def functions(%__MODULE__{} = client), do: %Functions{client: client}
  def apps(%__MODULE__{} = client), do: %Apps{client: client}
  def billing(%__MODULE__{} = client), do: %Billing{client: client}
  def admin(%__MODULE__{} = client), do: %Admin{client: client}
end

defmodule VortexSDK.Http do
  @moduledoc """
  HTTP wrapper using Req.
  """

  defstruct base_url: ""

  def new(base_url), do: %__MODULE__{base_url: base_url}

  def request(%__MODULE__{base_url: base_url}, method, path, body, token) do
    headers = [accept: "application/json"]
    headers = if body != nil, do: Keyword.put(headers, :content_type, "application/json"), else: headers
    headers = if token != nil, do: Keyword.put(headers, :authorization, "Bearer #{token}"), else: headers

    opts = [headers: headers, base_url: base_url, method: method]
    opts = if body != nil, do: Keyword.put(opts, :json, body), else: opts

    case Req.request(path, opts) do
      {:ok, %Req.Response{status: status, body: body}} when status < 400 ->
        {:ok, body}
      {:ok, %Req.Response{status: status, body: body}} ->
        error = Map.get(body, "error", %{"code" => "error", "message" => "Request failed"})
        {:error, %{status: status, code: error["code"], message: error["message"]}}
      {:error, e} ->
        {:error, e}
    end
  end
end

defmodule VortexSDK.Auth do
  defstruct client: nil

  def signup(%{client: c}, email, password, metadata \\ nil) do
    body = %{"email" => email, "password" => password}
    body = if metadata, do: Map.put(body, "metadata", metadata), else: body
    case Http.request(c.http, :post, "/v1/auth/signup", body, c.token) do
      {:ok, session} -> {:ok, session}
      {:error, e} -> {:error, e}
    end
  end

  def login(%{client: c}, email, password) do
    case Http.request(c.http, :post, "/v1/auth/login", %{"email" => email, "password" => password}, c.token) do
      {:ok, session} -> {:ok, session}
      {:error, e} -> {:error, e}
    end
  end

  def me(%{client: c}) do
    Http.request(c.http, :get, "/v1/auth/me", nil, c.token)
  end

  def list_oauth_providers(%{client: c}) do
    Http.request(c.http, :get, "/v1/auth/oauth/providers", nil, c.token)
  end
end

defmodule VortexSDK.Database do
  defstruct client: nil

  def from(%{client: c}, table), do: %VortexSDK.QueryBuilder{client: c, table: table}

  def insert(%{client: c}, table, rows) do
    Http.request(c.http, :post, "/v1/db/#{table}", %{"rows" => rows}, c.token)
  end

  def list_tables(%{client: c}) do
    Http.request(c.http, :get, "/v1/db/tables", nil, c.token)
  end
end

defmodule VortexSDK.QueryBuilder do
  defstruct client: nil, table: "", filters: [], limit: nil, offset: nil, order_by: [], count_total: false, select: nil

  def select(%__MODULE__{} = q, cols), do: %{q | select: cols}
  def filter(%__MODULE__{} = q, column, op, value), do: %{q | filters: q.filters ++ [%{"column" => column, "op" => op, "value" => value}]}
  def limit(%__MODULE__{} = q, n), do: %{q | limit: n}
  def offset(%__MODULE__{} = q, n), do: %{q | offset: n}
  def order_by(%__MODULE__{} = q, column, direction), do: %{q | order_by: q.order_by ++ [%{"column" => column, "direction" => direction}]}
  def count_total(%__MODULE__{} = q), do: %{q | count_total: true}

  def execute(%__MODULE__{client: c, table: table, filters: filters, limit: limit, offset: offset, order_by: order_by, count_total: count, select: select} = _q) do
    body = %{"filters" => filters}
    body = if count, do: Map.put(body, "countTotal", true), else: body
    body = if select != nil, do: Map.put(body, "select", select), else: body
    body = if limit != nil, do: Map.put(body, "limit", limit), else: body
    body = if offset != nil, do: Map.put(body, "offset", offset), else: body
    body = if order_by != [], do: Map.put(body, "orderBy", order_by), else: body
    Http.request(c.http, :post, "/v1/db/#{table}/query", body, c.token)
  end
end

defmodule VortexSDK.Storage do
  defstruct client: nil

  def create_bucket(%{client: c}, name, is_public \\ false) do
    Http.request(c.http, :post, "/v1/storage/buckets", %{"name" => name, "isPublic" => is_public}, c.token)
  end

  def list_buckets(%{client: c}) do
    Http.request(c.http, :get, "/v1/storage/buckets", nil, c.token)
  end

  def image_url(%{client: c}, bucket, path, opts \\ []) do
    params = Enum.map_join(opts, "&", fn {k, v} -> "#{k}=#{v}" end)
    "#{c.base_url}/v1/storage/public/#{bucket}/#{path}?#{params}"
  end
end

defmodule VortexSDK.Functions do
  defstruct client: nil

  def deploy(%{client: c}, name, code, description \\ "") do
    Http.request(c.http, :post, "/v1/functions", %{"name" => name, "code" => code, "description" => description}, c.token)
  end

  def list(%{client: c}) do
    Http.request(c.http, :get, "/v1/functions", nil, c.token)
  end

  def invoke(%{client: c}, name, data) do
    Http.request(c.http, :post, "/functions/#{name}", data, c.token)
  end
end

defmodule VortexSDK.Apps do
  defstruct client: nil

  def create(%{client: c}, name, title) do
    Http.request(c.http, :post, "/v1/apps", %{"name" => name, "title" => title}, c.token)
  end

  def list(%{client: c}) do
    Http.request(c.http, :get, "/v1/apps", nil, c.token)
  end
end

defmodule VortexSDK.Billing do
  defstruct client: nil

  def status(%{client: c}) do
    Http.request(c.http, :get, "/v1/billing/status", nil, c.token)
  end

  def list_plans(%{client: c}) do
    Http.request(c.http, :get, "/v1/billing/plans", nil, c.token)
  end

  def checkout(%{client: c}, plan_name, email, success_url \\ nil, cancel_url \\ nil) do
    body = %{"planName" => plan_name, "email" => email}
    body = if success_url, do: Map.put(body, "successUrl", success_url), else: body
    body = if cancel_url, do: Map.put(body, "cancelUrl", cancel_url), else: body
    Http.request(c.http, :post, "/v1/billing/checkout", body, c.token)
  end

  def list_transactions(%{client: c}, limit \\ 50) do
    Http.request(c.http, :get, "/v1/billing/transactions?limit=#{limit}", nil, c.token)
  end

  def get_me(%{client: c}) do
    Http.request(c.http, :get, "/v1/billing/me", nil, c.token)
  end
end

defmodule VortexSDK.Admin do
  defstruct client: nil

  def sql(%{client: c}, statement) do
    Http.request(c.http, :post, "/v1/sql", %{"sql" => statement}, c.token)
  end

  def list_policies(%{client: c}) do
    Http.request(c.http, :get, "/v1/policies", nil, c.token)
  end

  def list_users(%{client: c}) do
    Http.request(c.http, :get, "/v1/auth/users", nil, c.token)
  end
end

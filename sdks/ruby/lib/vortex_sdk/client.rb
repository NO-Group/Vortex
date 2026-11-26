# frozen_string_literal: true

require "json"
require "http"

module VortexSDK
  class Client
    attr_reader :base_url, :token

    def initialize(base_url, token: nil, timeout: 30)
      @base_url = base_url.chomp("/")
      @token = token
      @http = HTTP.timeout(timeout)
    end

    def set_token(token)
      @token = token
    end

    def request(method, path, body = nil, params = nil)
      url = "#{base_url}#{path}"
      url += "?#{URI::HTTP.build(path: path, query: params.to_s).query}" if params

      headers = { "Accept" => "application/json" }
      headers["Content-Type"] = "application/json" if body
      headers["Authorization"] = "Bearer #{token}" if token

      response = @http.request(method, url, headers: headers, json: body)

      if response.status.to_i >= 400
        data = JSON.parse(response.body.to_s) rescue {}
        error = data.fetch("error", { "code" => "error", "message" => response.reason_phrase })
        raise Error.new(response.status.to_i, error["code"], error["message"])
      end

      JSON.parse(response.body.to_s)
    end

    def auth
      @auth ||= AuthService.new(self)
    end

    def database
      @database ||= DatabaseService.new(self)
    end

    def storage
      @storage ||= StorageService.new(self)
    end

    def functions
      @functions ||= FunctionsService.new(self)
    end

    def apps
      @apps ||= AppsService.new(self)
    end

    def billing
      @billing ||= BillingService.new(self)
    end

    def admin
      @admin ||= AdminService.new(self)
    end
  end

  class AuthService
    def initialize(client) = @client = client

    def signup(email, password, metadata = nil)
      body = { email: email, password: password }
      body[:metadata] = metadata if metadata
      session = @client.request(:post, "/v1/auth/signup", body)
      @client.set_token(session["token"])
      session
    end

    def login(email, password)
      session = @client.request(:post, "/v1/auth/login", { email: email, password: password })
      @client.set_token(session["token"])
      session
    end

    def me
      @client.request(:get, "/v1/auth/me")
    end

    def list_oauth_providers
      @client.request(:get, "/v1/auth/oauth/providers")
    end

    def register_device(token, platform, push_service = nil)
      body = { token: token, platform: platform }
      body[:pushService] = push_service if push_service
      @client.request(:post, "/v1/notifications/devices", body)
    end

    def send_notification(title, body, data = nil)
      payload = { title: title, body: body }
      payload[:data] = data if data
      @client.request(:post, "/v1/notifications", payload)
    end
  end

  class DatabaseService
    def initialize(client) = @client = client

    def from(table) = QueryBuilder.new(@client, table)

    def insert(table, rows)
      @client.request(:post, "/v1/db/#{table}", { rows: rows })
    end

    def list_tables
      @client.request(:get, "/v1/db/tables")
    end
  end

  class QueryBuilder
    def initialize(client, table)
      @client = client
      @table = table
      @filters = []
      @limit = nil
      @offset = nil
      @order_by = []
      @count_total = false
      @select = nil
    end

    def select(cols) = (@select = cols; self)
    def filter(column, op, value) = (@filters << { column: column, op: op, value: value }; self)
    def limit(n) = (@limit = n; self)
    def offset(n) = (@offset = n; self)
    def order_by(column, direction = "asc") = (@order_by << { column: column, direction: direction }; self)
    def count_total = (@count_total = true; self)

    def execute
      body = { filters: @filters }
      body[:countTotal] = true if @count_total
      body[:select] = @select if @select
      body[:limit] = @limit if @limit
      body[:offset] = @offset if @offset
      body[:orderBy] = @order_by if @order_by.any?
      @client.request(:post, "/v1/db/#{@table}/query", body)
    end
  end

  class StorageService
    def initialize(client) = @client = client

    def create_bucket(name, is_public = false)
      @client.request(:post, "/v1/storage/buckets", { name: name, isPublic: is_public })
    end

    def list_buckets
      @client.request(:get, "/v1/storage/buckets")
    end

    def presign_upload(path)
      @client.request(:post, "/v1/storage/presign-upload", { path: path })
    end

    def image_url(bucket, path, opts = {})
      "#{@client.base_url}/v1/storage/public/#{bucket}/#{path}?#{opts.map { |k, v| "#{k}=#{v}" }.join("&")}"
    end
  end

  class FunctionsService
    def initialize(client) = @client = client

    def deploy(name, code, description = "")
      @client.request(:post, "/v1/functions", { name: name, code: code, description: description })
    end

    def list
      @client.request(:get, "/v1/functions")
    end

    def invoke(name, data)
      @client.request(:post, "/functions/#{name}", data)
    end

    def delete(name)
      @client.request(:delete, "/v1/functions/#{name}")
    end
  end

  class AppsService
    def initialize(client) = @client = client

    def create(name, title)
      @client.request(:post, "/v1/apps", { name: name, title: title })
    end

    def list
      @client.request(:get, "/v1/apps")
    end

    def delete(app)
      @client.request(:delete, "/v1/apps/#{app}")
    end
  end

  class BillingService
    def initialize(client) = @client = client

    def status
      @client.request(:get, "/v1/billing/status")
    end

    def list_plans
      @client.request(:get, "/v1/billing/plans")
    end

    def checkout(plan_name, email, success_url = nil, cancel_url = nil)
      body = { planName: plan_name, email: email }
      body[:successUrl] = success_url if success_url
      body[:cancelUrl] = cancel_url if cancel_url
      @client.request(:post, "/v1/billing/checkout", body)
    end

    def list_transactions(limit = 50)
      @client.request(:get, "/v1/billing/transactions", nil, { limit: limit })
    end

    def get_subscription
      @client.request(:get, "/v1/billing/subscription")
    end

    def cancel_subscription
      @client.request(:post, "/v1/billing/subscription/cancel")
    end

    def get_me
      @client.request(:get, "/v1/billing/me")
    end
  end

  class AdminService
    def initialize(client) = @client = client

    def sql(statement)
      @client.request(:post, "/v1/sql", { sql: statement })
    end

    def list_policies
      @client.request(:get, "/v1/policies")
    end

    def create_policy(input)
      @client.request(:post, "/v1/policies", input)
    end

    def list_users
      @client.request(:get, "/v1/auth/users")
    end

    def insights_overview
      @client.request(:get, "/v1/insights/overview")
    end
  end
end

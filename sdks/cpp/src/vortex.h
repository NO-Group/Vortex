#pragma once

// Vortex BaaS C++ SDK.
//
// A lightweight SDK wrapping the Vortex HTTP API using raw sockets/OpenSSL.
//
// ```cpp
// #include "vortex.h"
//
// Vortex::Client vortex("https://your-vortex.example.com");
// auto session = vortex.auth().signup("user@example.com", "password");
// ```

#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

namespace vortex {

// Simple JSON value type for responses.
struct Json {
    enum Type { Null, Bool, Number, String, Array, Object };
    Type type = Null;
    bool b = false;
    double num = 0;
    std::string str;
    std::vector<Json> arr;
    std::map<std::string, Json> obj;

    static Json parse(const std::string& s);
    std::string stringify() const;
    bool has(const std::string& key) const { return type == Object && obj.count(key) > 0; }
    const Json& operator[](const std::string& key) const;
    const Json& operator[](size_t i) const;
};

struct VortexError : std::runtime_error {
    int status;
    std::string code;
    VortexError(int status, const std::string& code, const std::string& message);
};

class Client;

// Forward declarations for services.
class AuthService;
class DatabaseService;
class StorageService;
class FunctionsService;
class AppsService;
class BillingService;
class AdminService;

class Client {
public:
    explicit Client(std::string baseUrl);
    ~Client();

    void setToken(const std::string& token);
    std::string getToken() const { return token_; }
    std::string baseUrl() const { return baseUrl_; }

    // Raw HTTP request helper.
    Json request(const std::string& method, const std::string& path,
                 const Json& body = Json{});

    std::shared_ptr<AuthService> auth() { return auth_; }
    std::shared_ptr<DatabaseService> database() { return database_; }
    std::shared_ptr<StorageService> storage() { return storage_; }
    std::shared_ptr<FunctionsService> functions() { return functions_; }
    std::shared_ptr<AppsService> apps() { return apps_; }
    std::shared_ptr<BillingService> billing() { return billing_; }
    std::shared_ptr<AdminService> admin() { return admin_; }

private:
    std::string baseUrl_;
    std::string token_;
    std::shared_ptr<AuthService> auth_;
    std::shared_ptr<DatabaseService> database_;
    std::shared_ptr<StorageService> storage_;
    std::shared_ptr<FunctionsService> functions_;
    std::shared_ptr<AppsService> apps_;
    std::shared_ptr<BillingService> billing_;
    std::shared_ptr<AdminService> admin_;

    std::string httpGet(const std::string& url, const std::string& auth);
    std::string httpPost(const std::string& url, const std::string& body, const std::string& auth);
    std::string httpDelete(const std::string& url, const std::string& auth);
};

class AuthService {
public:
    explicit AuthService(Client* client) : client_(client) {}
    Json signup(const std::string& email, const std::string& password);
    Json signup(const std::string& email, const std::string& password, const Json& metadata);
    Json login(const std::string& email, const std::string& password);
    Json me();
    Json listOAuthProviders();
    Json registerDevice(const std::string& token, const std::string& platform,
                        const std::string& pushService = "");
    Json sendNotification(const std::string& title, const std::string& body, const Json& data = Json{});

private:
    Client* client_;
};

class DatabaseService {
public:
    explicit DatabaseService(Client* client) : client_(client) {}

    class QueryBuilder {
    public:
        QueryBuilder(Client* client, std::string table) : client_(client), table_(std::move(table)) {}
        QueryBuilder& select(const std::vector<std::string>& cols);
        QueryBuilder& filter(const std::string& column, const std::string& op, const Json& value);
        QueryBuilder& limit(int n);
        QueryBuilder& offset(int n);
        QueryBuilder& orderBy(const std::string& column, const std::string& direction = "asc");
        QueryBuilder& countTotal();
        Json execute();

    private:
        Client* client_;
        std::string table_;
        std::vector<Json> filters_;
        std::vector<Json> orderBy_;
        std::vector<std::string> select_;
        std::optional<int> limit_, offset_;
        bool countTotal_ = false;
    };

    QueryBuilder from(std::string table);
    Json insert(const std::string& table, const std::vector<Json>& rows);
    Json listTables();

private:
    Client* client_;
};

class StorageService {
public:
    explicit StorageService(Client* client) : client_(client) {}
    Json createBucket(const std::string& name, bool isPublic = false);
    Json listBuckets();
    Json presignUpload(const std::string& path);
    std::string imageUrl(const std::string& bucket, const std::string& path,
                         const std::map<std::string, std::string>& opts = {});

private:
    Client* client_;
};

class FunctionsService {
public:
    explicit FunctionsService(Client* client) : client_(client) {}
    Json deploy(const std::string& name, const std::string& language,
                const std::string& code, const std::string& description = "");
    Json list();
    Json invoke(const std::string& name, const Json& data);
    Json get(const std::string& name);
    void remove(const std::string& name);

private:
    Client* client_;
};

class AppsService {
public:
    explicit AppsService(Client* client) : client_(client) {}
    Json create(const std::string& name, const std::string& title, const std::string& description = "");
    Json list();
    Json get(const std::string& id);
    void remove(const std::string& id);

private:
    Client* client_;
};

class BillingService {
public:
    explicit BillingService(Client* client) : client_(client) {}
    Json status();
    Json listPlans();
    Json checkout(const std::string& planName, const std::string& email,
                  const std::string& successUrl = "", const std::string& cancelUrl = "");
    Json listTransactions(int limit = 50);
    Json getSubscription();
    Json cancelSubscription();
    Json getMe();

private:
    Client* client_;
};

class AdminService {
public:
    explicit AdminService(Client* client) : client_(client) {}
    Json sql(const std::string& statement);
    Json listPolicies();
    Json createPolicy(const std::string& table, const Json& policy);
    Json listUsers();
    Json insightsOverview();

private:
    Client* client_;
};

} // namespace vortex

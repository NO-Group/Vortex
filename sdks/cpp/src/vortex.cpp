#include "vortex.h"

#include <curl/curl.h>
#include <sstream>

namespace vortex {

// --- Json helpers ---

static Json parseJson(const std::string& s, size_t& i);

static size_t writeCallback(char* ptr, size_t size, size_t nmemb, void* userdata) {
    std::string* out = static_cast<std::string*>(userdata);
    out->append(ptr, size * nmemb);
    return size * nmemb;
}

Json Json::parse(const std::string& s) {
    size_t i = 0;
    return parseJson(s, i);
}

static std::string parseString(const std::string& s, size_t& i) {
    std::string result;
    i++; // skip opening quote
    while (i < s.size() && s[i] != '"') {
        if (s[i] == '\\' && i + 1 < s.size()) {
            i++;
            switch (s[i]) {
                case 'n': result += '\n'; break;
                case 't': result += '\t'; break;
                case 'r': result += '\r'; break;
                case 'b': result += '\b'; break;
                case 'f': result += '\f'; break;
                case '"': result += '"'; break;
                case '\\': result += '\\'; break;
                case '/': result += '/'; break;
                default: result += s[i]; break;
            }
        } else {
            result += s[i];
        }
        i++;
    }
    if (i < s.size()) i++; // skip closing quote
    return result;
}

static Json parseJson(const std::string& s, size_t& i) {
    Json result;
    while (i < s.size() && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++;
    if (i >= s.size()) return result;

    char c = s[i];
    if (c == '{') {
        result.type = Json::Object;
        i++;
        while (i < s.size()) {
            while (i < s.size() && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++;
            if (i < s.size() && s[i] == '}') { i++; break; }
            std::string key = parseString(s, i);
            while (i < s.size() && s[i] != ':') i++;
            if (i < s.size()) i++;
            Json val = parseJson(s, i);
            result.obj[key] = val;
            while (i < s.size() && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++;
            if (i < s.size() && s[i] == ',') i++;
        }
    } else if (c == '[') {
        result.type = Json::Array;
        i++;
        while (i < s.size()) {
            while (i < s.size() && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++;
            if (i < s.size() && s[i] == ']') { i++; break; }
            result.arr.push_back(parseJson(s, i));
            while (i < s.size() && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++;
            if (i < s.size() && s[i] == ',') i++;
        }
    } else if (c == '"') {
        result.type = Json::String;
        result.str = parseString(s, i);
    } else if (s.compare(i, 4, "true") == 0) {
        result.type = Json::Bool;
        result.b = true;
        i += 4;
    } else if (s.compare(i, 5, "false") == 0) {
        result.type = Json::Bool;
        result.b = false;
        i += 5;
    } else if (s.compare(i, 4, "null") == 0) {
        result.type = Json::Null;
        i += 4;
    } else {
        result.type = Json::Number;
        size_t start = i;
        while (i < s.size() && (s[i] == '-' || s[i] == '+' || s[i] == '.' ||
                (s[i] >= '0' && s[i] <= '9'))) i++;
        result.num = std::stod(s.substr(start, i - start));
    }
    return result;
}

std::string Json::stringify() const {
    std::ostringstream os;
    switch (type) {
        case Null: os << "null"; break;
        case Bool: os << (b ? "true" : "false"); break;
        case Number: os << num; break;
        case String: os << '"' << str << '"'; break;
        case Array: {
            os << '[';
            for (size_t i = 0; i < arr.size(); i++) {
                if (i > 0) os << ',';
                os << arr[i].stringify();
            }
            os << ']';
            break;
        }
        case Object: {
            os << '{';
            bool first = true;
            for (const auto& [k, v] : obj) {
                if (!first) os << ',';
                os << '"' << k << "\":" << v.stringify();
                first = false;
            }
            os << '}';
            break;
        }
    }
    return os.str();
}

const Json& Json::operator[](const std::string& key) const {
    static const Json nullJson;
    if (type == Object) {
        auto it = obj.find(key);
        if (it != obj.end()) return it->second;
    }
    return nullJson;
}

const Json& Json::operator[](size_t i) const {
    static const Json nullJson;
    if (type == Array && i < arr.size()) return arr[i];
    return nullJson;
}

// --- VortexError ---

VortexError::VortexError(int status, const std::string& code, const std::string& message)
    : std::runtime_error(message), status(status), code(code) {}

// --- Client ---

static std::string httpRequest(const std::string& url, const std::string& method,
                               const std::string& body, const std::string& auth) {
    CURL* curl = curl_easy_init();
    std::string response;
    if (!curl) return response;

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, method.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 2L);

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Accept: application/json");
    if (!body.empty()) {
        headers = curl_slist_append(headers, "Content-Type: application/json");
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
    }
    if (!auth.empty()) {
        headers = curl_slist_append(headers, ("Authorization: Bearer " + auth).c_str());
    }
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    curl_easy_perform(curl);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    return response;
}

Client::Client(std::string baseUrl) : baseUrl_(std::move(baseUrl)) {
    if (!baseUrl_.empty() && baseUrl_.back() == '/') baseUrl_.pop_back();
    auth_ = std::make_shared<AuthService>(this);
    database_ = std::make_shared<DatabaseService>(this);
    storage_ = std::make_shared<StorageService>(this);
    functions_ = std::make_shared<FunctionsService>(this);
    apps_ = std::make_shared<AppsService>(this);
    billing_ = std::make_shared<BillingService>(this);
    admin_ = std::make_shared<AdminService>(this);
}

Client::~Client() = default;

void Client::setToken(const std::string& token) { token_ = token; }

Json Client::request(const std::string& method, const std::string& path, const Json& body) {
    std::string url = baseUrl_ + path;
    std::string bodyStr = body.type == Json::Null ? "" : body.stringify();
    std::string response = httpRequest(url, method, bodyStr, token_);

    Json result = Json::parse(response);
    if (result.has("error")) {
        throw VortexError(0, result["error"]["code"].str, result["error"]["message"].str);
    }
    return result;
}

std::string Client::httpGet(const std::string& url, const std::string& auth) {
    return httpRequest(url, "GET", "", auth);
}

std::string Client::httpPost(const std::string& url, const std::string& body, const std::string& auth) {
    return httpRequest(url, "POST", body, auth);
}

std::string Client::httpDelete(const std::string& url, const std::string& auth) {
    return httpRequest(url, "DELETE", "", auth);
}

// --- AuthService ---

Json AuthService::signup(const std::string& email, const std::string& password) {
    Json body;
    body.type = Json::Object;
    body.obj["email"] = Json::parse("\"" + email + "\"");
    body.obj["password"] = Json::parse("\"" + password + "\"");
    Json resp = client_->request("POST", "/v1/auth/signup", body);
    client_->setToken(resp["token"].str);
    return resp;
}

Json AuthService::signup(const std::string& email, const std::string& password, const Json& metadata) {
    Json body;
    body.type = Json::Object;
    body.obj["email"] = Json::parse("\"" + email + "\"");
    body.obj["password"] = Json::parse("\"" + password + "\"");
    body.obj["metadata"] = metadata;
    Json resp = client_->request("POST", "/v1/auth/signup", body);
    client_->setToken(resp["token"].str);
    return resp;
}

Json AuthService::login(const std::string& email, const std::string& password) {
    Json body;
    body.type = Json::Object;
    body.obj["email"] = Json::parse("\"" + email + "\"");
    body.obj["password"] = Json::parse("\"" + password + "\"");
    Json resp = client_->request("POST", "/v1/auth/login", body);
    client_->setToken(resp["token"].str);
    return resp;
}

Json AuthService::me() { return client_->request("GET", "/v1/auth/me"); }

Json AuthService::listOAuthProviders() { return client_->request("GET", "/v1/auth/oauth/providers"); }

Json AuthService::registerDevice(const std::string& token, const std::string& platform,
                                 const std::string& pushService) {
    Json body;
    body.type = Json::Object;
    body.obj["token"] = Json::parse("\"" + token + "\"");
    body.obj["platform"] = Json::parse("\"" + platform + "\"");
    if (!pushService.empty()) {
        body.obj["pushService"] = Json::parse("\"" + pushService + "\"");
    }
    return client_->request("POST", "/v1/notifications/devices", body);
}

Json AuthService::sendNotification(const std::string& title, const std::string& body, const Json& data) {
    Json bodyJson;
    bodyJson.type = Json::Object;
    bodyJson.obj["title"] = Json::parse("\"" + title + "\"");
    bodyJson.obj["body"] = Json::parse("\"" + body + "\"");
    if (data.type != Json::Null) {
        bodyJson.obj["data"] = data;
    }
    return client_->request("POST", "/v1/notifications", bodyJson);
}

// --- DatabaseService ---

DatabaseService::QueryBuilder& DatabaseService::QueryBuilder::select(const std::vector<std::string>& cols) {
    select_ = cols;
    return *this;
}

DatabaseService::QueryBuilder& DatabaseService::QueryBuilder::filter(const std::string& column,
        const std::string& op, const Json& value) {
    Json f;
    f.type = Json::Object;
    f.obj["column"] = Json::parse("\"" + column + "\"");
    f.obj["op"] = Json::parse("\"" + op + "\"");
    f.obj["value"] = value;
    filters_.push_back(f);
    return *this;
}

DatabaseService::QueryBuilder& DatabaseService::QueryBuilder::limit(int n) {
    limit_ = n;
    return *this;
}

DatabaseService::QueryBuilder& DatabaseService::QueryBuilder::offset(int n) {
    offset_ = n;
    return *this;
}

DatabaseService::QueryBuilder& DatabaseService::QueryBuilder::orderBy(const std::string& column,
        const std::string& direction) {
    Json o;
    o.type = Json::Object;
    o.obj["column"] = Json::parse("\"" + column + "\"");
    o.obj["direction"] = Json::parse("\"" + direction + "\"");
    orderBy_.push_back(o);
    return *this;
}

DatabaseService::QueryBuilder& DatabaseService::QueryBuilder::countTotal() {
    countTotal_ = true;
    return *this;
}

Json DatabaseService::QueryBuilder::execute() {
    Json body;
    body.type = Json::Object;
    Json filtersArr;
    filtersArr.type = Json::Array;
    filtersArr.arr = filters_;
    body.obj["filters"] = filtersArr;
    if (countTotal_) body.obj["countTotal"] = Json::parse("true");
    if (!select_.empty()) {
        Json sel;
        sel.type = Json::Array;
        for (const auto& c : select_) sel.arr.push_back(Json::parse("\"" + c + "\""));
        body.obj["select"] = sel;
    }
    if (limit_.has_value()) body.obj["limit"] = Json::parse(std::to_string(limit_.value()));
    if (offset_.has_value()) body.obj["offset"] = Json::parse(std::to_string(offset_.value()));
    if (!orderBy_.empty()) {
        Json ob;
        ob.type = Json::Array;
        ob.arr = orderBy_;
        body.obj["orderBy"] = ob;
    }
    return client_->request("POST", "/v1/db/" + table_ + "/query", body);
}

DatabaseService::QueryBuilder DatabaseService::from(std::string table) {
    return QueryBuilder(client_, std::move(table));
}

Json DatabaseService::insert(const std::string& table, const std::vector<Json>& rows) {
    Json body;
    body.type = Json::Object;
    Json rowsArr;
    rowsArr.type = Json::Array;
    rowsArr.arr = rows;
    body.obj["rows"] = rowsArr;
    return client_->request("POST", "/v1/db/" + table, body);
}

Json DatabaseService::listTables() { return client_->request("GET", "/v1/db/tables"); }

// --- StorageService ---

Json StorageService::createBucket(const std::string& name, bool isPublic) {
    Json body;
    body.type = Json::Object;
    body.obj["name"] = Json::parse("\"" + name + "\"");
    body.obj["isPublic"] = Json::parse(isPublic ? "true" : "false");
    return client_->request("POST", "/v1/storage/buckets", body);
}

Json StorageService::listBuckets() { return client_->request("GET", "/v1/storage/buckets"); }

Json StorageService::presignUpload(const std::string& path) {
    Json body;
    body.type = Json::Object;
    body.obj["path"] = Json::parse("\"" + path + "\"");
    return client_->request("POST", "/v1/storage/presign-upload", body);
}

std::string StorageService::imageUrl(const std::string& bucket, const std::string& path,
        const std::map<std::string, std::string>& opts) {
    std::string url = client_->baseUrl() + "/v1/storage/public/" + bucket + "/" + path;
    if (opts.empty()) return url;
    url += "?";
    bool first = true;
    for (const auto& [k, v] : opts) {
        if (!first) url += "&";
        url += k + "=" + v;
        first = false;
    }
    return url;
}

// --- FunctionsService ---

Json FunctionsService::deploy(const std::string& name, const std::string& language,
        const std::string& code, const std::string& description) {
    Json body;
    body.type = Json::Object;
    body.obj["name"] = Json::parse("\"" + name + "\"");
    body.obj["language"] = Json::parse("\"" + language + "\"");
    body.obj["code"] = Json::parse("\"" + code + "\"");
    body.obj["description"] = Json::parse("\"" + description + "\"");
    return client_->request("POST", "/v1/functions", body);
}

Json FunctionsService::list() { return client_->request("GET", "/v1/functions"); }

Json FunctionsService::invoke(const std::string& name, const Json& data) {
    return client_->request("POST", "/functions/" + name, data);
}

Json FunctionsService::get(const std::string& name) {
    return client_->request("GET", "/v1/functions/" + name);
}

void FunctionsService::remove(const std::string& name) {
    client_->request("DELETE", "/v1/functions/" + name);
}

// --- AppsService ---

Json AppsService::create(const std::string& name, const std::string& title,
        const std::string& description) {
    Json body;
    body.type = Json::Object;
    body.obj["name"] = Json::parse("\"" + name + "\"");
    body.obj["title"] = Json::parse("\"" + title + "\"");
    body.obj["description"] = Json::parse("\"" + description + "\"");
    return client_->request("POST", "/v1/apps", body);
}

Json AppsService::list() { return client_->request("GET", "/v1/apps"); }

Json AppsService::get(const std::string& id) { return client_->request("GET", "/v1/apps/" + id); }

void AppsService::remove(const std::string& id) {
    client_->request("DELETE", "/v1/apps/" + id);
}

// --- BillingService ---

Json BillingService::status() { return client_->request("GET", "/v1/billing/status"); }

Json BillingService::listPlans() { return client_->request("GET", "/v1/billing/plans"); }

Json BillingService::checkout(const std::string& planName, const std::string& email,
        const std::string& successUrl, const std::string& cancelUrl) {
    Json body;
    body.type = Json::Object;
    body.obj["planName"] = Json::parse("\"" + planName + "\"");
    body.obj["email"] = Json::parse("\"" + email + "\"");
    if (!successUrl.empty()) body.obj["successUrl"] = Json::parse("\"" + successUrl + "\"");
    if (!cancelUrl.empty()) body.obj["cancelUrl"] = Json::parse("\"" + cancelUrl + "\"");
    return client_->request("POST", "/v1/billing/checkout", body);
}

Json BillingService::listTransactions(int limit) {
    return client_->request("GET", "/v1/billing/transactions?limit=" + std::to_string(limit));
}

Json BillingService::getSubscription() { return client_->request("GET", "/v1/billing/subscription"); }

Json BillingService::cancelSubscription() {
    return client_->request("POST", "/v1/billing/subscription/cancel");
}

Json BillingService::getMe() { return client_->request("GET", "/v1/billing/me"); }

// --- AdminService ---

Json AdminService::sql(const std::string& statement) {
    Json body;
    body.type = Json::Object;
    body.obj["sql"] = Json::parse("\"" + statement + "\"");
    return client_->request("POST", "/v1/sql", body);
}

Json AdminService::listPolicies() { return client_->request("GET", "/v1/policies"); }

Json AdminService::createPolicy(const std::string& table, const Json& policy) {
    Json body;
    body.type = Json::Object;
    body.obj["table"] = Json::parse("\"" + table + "\"");
    body.obj["policy"] = policy;
    return client_->request("POST", "/v1/policies", body);
}

Json AdminService::listUsers() { return client_->request("GET", "/v1/auth/users"); }

Json AdminService::insightsOverview() { return client_->request("GET", "/v1/insights/overview"); }

} // namespace vortex

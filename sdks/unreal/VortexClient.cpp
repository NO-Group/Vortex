// Vortex BaaS Unreal Engine SDK implementation.

#include "VortexClient.h"
#include "JsonSerializer.h"

#define LOCLOG_CATEGORY "VortexSDK"

UVortexClient::UVortexClient()
{
    Auth = NewObject<UVortexAuthService>();
    Database = NewObject<UVortexDatabaseService>();
    Storage = NewObject<UVortexStorageService>();
    Functions = NewObject<UVortexFunctionsService>();
    Apps = NewObject<UVortexAppsService>();
    Billing = NewObject<UVortexBillingService>();
    Admin = NewObject<UVortexAdminService>();

    Auth->Client = this;
    Database->Client = this;
    Storage->Client = this;
    Functions->Client = this;
    Apps->Client = this;
    Billing->Client = this;
    Admin->Client = this;
}

void UVortexClient::Initialize(const FString& BaseUrlIn)
{
    BaseUrl = BaseUrlIn;
    while (BaseUrl.EndsWith(TEXT("/")))
    {
        BaseUrl.RemoveAt(BaseUrl.Len() - 1);
    }
}

void UVortexClient::SendHttpRequest(const FString& Method, const FString& FullUrl,
    const FString& Body, FVortexResponse OnSuccess, FVortexError OnError)
{
    IHttpModule* HttpModule = &FHttpModule::Get();
    TSharedRef<IHttpRequest> Request = HttpModule->CreateRequest();
    Request->SetURL(FullUrl);
    Request->SetVerb(Method);
    Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
    if (!Body.IsEmpty())
    {
        Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
        Request->SetContentAsString(Body);
    }
    if (!Token.IsEmpty())
    {
        Request->SetHeader(TEXT("Authorization"), FString::Printf(TEXT("Bearer %s"), *Token));
    }

    Request->OnProcessRequestComplete().BindLambda(
        [OnSuccess, OnError, this](FHttpRequestPtr Req, FHttpResponsePtr Response, bool bSuccess)
        {
            if (!bSuccess || !Response.IsValid())
            {
                OnError.ExecuteIfBound(0, TEXT("error"), TEXT("Request failed"));
                return;
            }

            FString BodyText = Response->GetContentAsString();
            int32 StatusCode = Response->GetResponseCode();

            if (StatusCode >= 400)
            {
                FJsonObject Parsed;
                FJsonDocument Doc;
                if (FJsonSerializer::DeserializeFromString(BodyText, Doc) && Doc.IsObject())
                {
                    Parsed = Doc.GetObject();
                    const FJsonObject* ErrorObj = Parsed.TryGetFieldValue<FJsonObject>(TEXT("error"));
                    if (ErrorObj)
                    {
                        FString Code, Message;
                        ErrorObj->TryGetStringFieldValue(TEXT("code"), Code);
                        ErrorObj->TryGetStringFieldValue(TEXT("message"), Message);
                        OnError.ExecuteIfBound(StatusCode, Code, Message);
                        return;
                    }
                }
                OnError.ExecuteIfBound(StatusCode, TEXT("error"), TEXT("Request failed"));
                return;
            }

            FJsonDocument Doc;
            if (FJsonSerializer::DeserializeFromString(BodyText, Doc) && Doc.IsObject())
            {
                OnSuccess.ExecuteIfBound(Doc.GetObject());
            }
            else
            {
                OnError.ExecuteIfBound(StatusCode, TEXT("parse"), TEXT("Invalid JSON response"));
            }
        });

    Request->ProcessRequest();
}

void UVortexClient::Request(const FString& Method, const FString& Path,
    const FString& Body, FVortexResponse OnSuccess, FVortexError OnError)
{
    SendHttpRequest(Method, BaseUrl + Path, Body, OnSuccess, OnError);
}

FString UVortexClient::ImageUrl(const FString& Bucket, const FString& Path,
    const TMap<FString, FString>& Opts)
{
    FString Url = FString::Printf(TEXT("%s/v1/storage/public/%s/%s"), *BaseUrl, *Bucket, *Path);
    if (Opts.Num() > 0)
    {
        FString Params;
        bool First = true;
        for (const auto& Pair : Opts)
        {
            if (!First) Params += TEXT("&");
            Params += FString::Printf(TEXT("%s=%s"), *Pair.Key, *Pair.Value);
            First = false;
        }
        Url += FString(TEXT("?")) + Params;
    }
    return Url;
}

// --- AuthService ---

UVortexAuthService::UVortexAuthService() {}

void UVortexAuthService::Signup(const FString& Email, const FString& Password,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(TEXT("{\"email\":\"%s\",\"password\":\"%s\"}"), *Email, *Password);
    Client->Request(TEXT("POST"), TEXT("/v1/auth/signup"), Body,
        [this, OnSuccess](const FJsonObject& Response)
        {
            FString Token;
            Response.TryGetStringFieldValue(TEXT("token"), Token);
            Client->Token = Token;
            OnSuccess.ExecuteIfBound(Response);
        }, OnError);
}

void UVortexAuthService::Login(const FString& Email, const FString& Password,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(TEXT("{\"email\":\"%s\",\"password\":\"%s\"}"), *Email, *Password);
    Client->Request(TEXT("POST"), TEXT("/v1/auth/login"), Body,
        [this, OnSuccess](const FJsonObject& Response)
        {
            FString Token;
            Response.TryGetStringFieldValue(TEXT("token"), Token);
            Client->Token = Token;
            OnSuccess.ExecuteIfBound(Response);
        }, OnError);
}

void UVortexAuthService::Me(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/auth/me"), TEXT(""), OnSuccess, OnError);
}

void UVortexAuthService::ListOAuthProviders(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/auth/oauth/providers"), TEXT(""), OnSuccess, OnError);
}

void UVortexAuthService::RegisterDevice(const FString& PushToken, const FString& Platform,
    const FString& PushService, FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(TEXT("{\"token\":\"%s\",\"platform\":\"%s\""), *PushToken, *Platform);
    if (!PushService.IsEmpty())
    {
        Body += FString::Printf(TEXT(",\"pushService\":\"%s\""), *PushService);
    }
    Body += TEXT("}");
    Client->Request(TEXT("POST"), TEXT("/v1/notifications/devices"), Body, OnSuccess, OnError);
}

void UVortexAuthService::SendNotification(const FString& Title, const FString& Body,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Payload = FString::Printf(TEXT("{\"title\":\"%s\",\"body\":\"%s\"}"), *Title, *Body);
    Client->Request(TEXT("POST"), TEXT("/v1/notifications"), Payload, OnSuccess, OnError);
}

// --- DatabaseService ---

UVortexDatabaseService::UVortexDatabaseService() {}

UVortexQueryBuilder* UVortexDatabaseService::From(const FString& Table)
{
    UVortexQueryBuilder* Builder = NewObject<UVortexQueryBuilder>();
    Builder->Client = Client;
    Builder->Table = Table;
    return Builder;
}

void UVortexDatabaseService::Insert(const FString& Table, const FString& RowsJson,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(TEXT("{\"rows\":%s}"), *RowsJson);
    Client->Request(TEXT("POST"), FString::Printf(TEXT("/v1/db/%s"), *Table), Body, OnSuccess, OnError);
}

void UVortexDatabaseService::ListTables(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/db/tables"), TEXT(""), OnSuccess, OnError);
}

// --- QueryBuilder ---

UVortexQueryBuilder::UVortexQueryBuilder() {}

UVortexQueryBuilder* UVortexQueryBuilder::SelectColumns(const FString& Cols)
{
    Select = Cols;
    return this;
}

UVortexQueryBuilder* UVortexQueryBuilder::Filter(const FString& Column, const FString& Op, const FString& Value)
{
    FString Entry = FString::Printf(
        TEXT("{\"column\":\"%s\",\"op\":\"%s\",\"value\":\"%s\"}"), *Column, *Op, *Value);
    Filters.Add(Entry);
    return this;
}

UVortexQueryBuilder* UVortexQueryBuilder::Limit(int32 N) { Limit = N; return this; }
UVortexQueryBuilder* UVortexQueryBuilder::Offset(int32 N) { Offset = N; return this; }

UVortexQueryBuilder* UVortexQueryBuilder::OrderByColumn(const FString& Column, const FString& Direction)
{
    OrderBy.Add(FString::Printf(TEXT("{\"column\":\"%s\",\"direction\":\"%s\"}"), *Column, *Direction));
    return this;
}

UVortexQueryBuilder* UVortexQueryBuilder::CountTotal() { CountTotal = true; return this; }

void UVortexQueryBuilder::Execute(FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(TEXT("{\"filters\":[%s]}"), *FString::Join(Filters, TEXT(",")));
    if (CountTotal) Body += TEXT(",\"countTotal\":true");
    if (!Select.IsEmpty()) Body += FString::Printf(TEXT(",\"select\":%s"), *Select);
    if (Limit >= 0) Body += FString::Printf(TEXT(",\"limit\":%d"), Limit);
    if (Offset >= 0) Body += FString::Printf(TEXT(",\"offset\":%d"), Offset);
    if (OrderBy.Num() > 0) Body += FString::Printf(TEXT(",\"orderBy\":[%s]"), *FString::Join(OrderBy, TEXT(",")));
    Body += TEXT("}");

    Client->Request(TEXT("POST"), FString::Printf(TEXT("/v1/db/%s/query"), *Table), Body, OnSuccess, OnError);
}

// --- StorageService ---

UVortexStorageService::UVortexStorageService() {}

void UVortexStorageService::CreateBucket(const FString& Name, bool IsPublic,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(TEXT("{\"name\":\"%s\",\"isPublic\":%s}"),
        *Name, IsPublic ? TEXT("true") : TEXT("false"));
    Client->Request(TEXT("POST"), TEXT("/v1/storage/buckets"), Body, OnSuccess, OnError);
}

void UVortexStorageService::ListBuckets(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/storage/buckets"), TEXT(""), OnSuccess, OnError);
}

void UVortexStorageService::PresignUpload(const FString& Path,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(TEXT("{\"path\":\"%s\"}"), *Path);
    Client->Request(TEXT("POST"), TEXT("/v1/storage/presign-upload"), Body, OnSuccess, OnError);
}

// --- FunctionsService ---

UVortexFunctionsService::UVortexFunctionsService() {}

void UVortexFunctionsService::Deploy(const FString& Name, const FString& Language,
    const FString& Code, const FString& Description,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(
        TEXT("{\"name\":\"%s\",\"language\":\"%s\",\"code\":\"%s\",\"description\":\"%s\"}"),
        *Name, *Language, *Code, *Description);
    Client->Request(TEXT("POST"), TEXT("/v1/functions"), Body, OnSuccess, OnError);
}

void UVortexFunctionsService::List(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/functions"), TEXT(""), OnSuccess, OnError);
}

void UVortexFunctionsService::Invoke(const FString& Name, const FString& DataJson,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("POST"), FString::Printf(TEXT("/functions/%s"), *Name), DataJson, OnSuccess, OnError);
}

void UVortexFunctionsService::Delete(const FString& Name,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("DELETE"), FString::Printf(TEXT("/v1/functions/%s"), *Name), TEXT(""), OnSuccess, OnError);
}

// --- AppsService ---

UVortexAppsService::UVortexAppsService() {}

void UVortexAppsService::Create(const FString& Name, const FString& Title, const FString& Description,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(
        TEXT("{\"name\":\"%s\",\"title\":\"%s\",\"description\":\"%s\"}"),
        *Name, *Title, *Description);
    Client->Request(TEXT("POST"), TEXT("/v1/apps"), Body, OnSuccess, OnError);
}

void UVortexAppsService::List(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/apps"), TEXT(""), OnSuccess, OnError);
}

void UVortexAppsService::Delete(const FString& Id,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("DELETE"), FString::Printf(TEXT("/v1/apps/%s"), *Id), TEXT(""), OnSuccess, OnError);
}

// --- BillingService ---

UVortexBillingService::UVortexBillingService() {}

void UVortexBillingService::Status(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/billing/status"), TEXT(""), OnSuccess, OnError);
}

void UVortexBillingService::ListPlans(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/billing/plans"), TEXT(""), OnSuccess, OnError);
}

void UVortexBillingService::Checkout(const FString& PlanName, const FString& Email,
    const FString& SuccessUrl, const FString& CancelUrl,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(TEXT("{\"planName\":\"%s\",\"email\":\"%s\""), *PlanName, *Email);
    if (!SuccessUrl.IsEmpty()) Body += FString::Printf(TEXT(",\"successUrl\":\"%s\""), *SuccessUrl);
    if (!CancelUrl.IsEmpty()) Body += FString::Printf(TEXT(",\"cancelUrl\":\"%s\""), *CancelUrl);
    Body += TEXT("}");
    Client->Request(TEXT("POST"), TEXT("/v1/billing/checkout"), Body, OnSuccess, OnError);
}

void UVortexBillingService::ListTransactions(int32 Limit,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), FString::Printf(TEXT("/v1/billing/transactions?limit=%d"), Limit),
        TEXT(""), OnSuccess, OnError);
}

void UVortexBillingService::GetSubscription(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/billing/subscription"), TEXT(""), OnSuccess, OnError);
}

void UVortexBillingService::CancelSubscription(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("POST"), TEXT("/v1/billing/subscription/cancel"), TEXT(""), OnSuccess, OnError);
}

void UVortexBillingService::GetMe(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/billing/me"), TEXT(""), OnSuccess, OnError);
}

// --- AdminService ---

UVortexAdminService::UVortexAdminService() {}

void UVortexAdminService::Sql(const FString& Statement,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(TEXT("{\"sql\":\"%s\"}"), *Statement);
    Client->Request(TEXT("POST"), TEXT("/v1/sql"), Body, OnSuccess, OnError);
}

void UVortexAdminService::ListPolicies(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/policies"), TEXT(""), OnSuccess, OnError);
}

void UVortexAdminService::CreatePolicy(const FString& Table, const FString& PolicyJson,
    FVortexResponse OnSuccess, FVortexError OnError)
{
    FString Body = FString::Printf(TEXT("{\"table\":\"%s\",\"policy\":%s}"), *Table, *PolicyJson);
    Client->Request(TEXT("POST"), TEXT("/v1/policies"), Body, OnSuccess, OnError);
}

void UVortexAdminService::ListUsers(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/auth/users"), TEXT(""), OnSuccess, OnError);
}

void UVortexAdminService::InsightsOverview(FVortexResponse OnSuccess, FVortexError OnError)
{
    Client->Request(TEXT("GET"), TEXT("/v1/insights/overview"), TEXT(""), OnSuccess, OnError);
}

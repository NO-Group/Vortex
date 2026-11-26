// Vortex BaaS Unreal Engine SDK.
//
// ```cpp
// UVortexClient* vortex = NewObject<UVortexClient>();
// vortex->Initialize(FString(TEXT("https://your-vortex.example.com")));
// vortex->Auth->Signup(email, password, OnSuccess, OnError);
// ```

#pragma once

#include "CoreMinimal.h"
#include "Json.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "VortexClient.generated.h"

UCLASS(BlueprintType, Blueprintable)
class VORTEXTSDK_API UVortexClient : public UObject
{
    GENERATED_BODY()

public:
    UVortexClient();

    void Initialize(const FString& BaseUrl);
    FString GetBaseUrl() const { return BaseUrl; }

    FString Token;

    UPROPERTY(BlueprintReadOnly, VisibleAnywhere)
    TObjectPtr<UVortexAuthService> Auth;

    UPROPERTY(BlueprintReadOnly, VisibleAnywhere)
    TObjectPtr<UVortexDatabaseService> Database;

    UPROPERTY(BlueprintReadOnly, VisibleAnywhere)
    TObjectPtr<UVortexStorageService> Storage;

    UPROPERTY(BlueprintReadOnly, VisibleAnywhere)
    TObjectPtr<UVortexFunctionsService> Functions;

    UPROPERTY(BlueprintReadOnly, VisibleAnywhere)
    TObjectPtr<UVortexAppsService> Apps;

    UPROPERTY(BlueprintReadOnly, VisibleAnywhere)
    TObjectPtr<UVortexBillingService> Billing;

    UPROPERTY(BlueprintReadOnly, VisibleAnywhere)
    TObjectPtr<UVortexAdminService> Admin;

    UFUNCTION(BlueprintCallable, Category = "Vortex")
    void Request(
        const FString& Method,
        const FString& Path,
        const FString& Body,
        FVortexResponse OnSuccess,
        FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex")
    FString ImageUrl(const FString& Bucket, const FString& Path,
        const TMap<FString, FString>& Opts = TMap<FString, FString>());

private:
    FString BaseUrl;

    void SendHttpRequest(const FString& Method, const FString& FullUrl, const FString& Body,
        FVortexResponse OnSuccess, FVortexError OnError);
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FVortexResponse, const FJsonObject&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FVortexError, int32, const FString&, const FString&);

UCLASS(BlueprintType, Blueprintable)
class VORTEXTSDK_API UVortexAuthService : public UObject
{
    GENERATED_BODY()
public:
    UVortexAuthService();

    UFUNCTION(BlueprintCallable, Category = "Vortex|Auth")
    void Signup(const FString& Email, const FString& Password,
        FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Auth")
    void Login(const FString& Email, const FString& Password,
        FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Auth")
    void Me(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Auth")
    void ListOAuthProviders(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Auth")
    void RegisterDevice(const FString& PushToken, const FString& Platform,
        const FString& PushService, FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Auth")
    void SendNotification(const FString& Title, const FString& Body,
        FVortexResponse OnSuccess, FVortexError OnError);

    UVortexClient* Client = nullptr;
};

UCLASS(BlueprintType, Blueprintable)
class VORTEXTSDK_API UVortexDatabaseService : public UObject
{
    GENERATED_BODY()
public:
    UVortexDatabaseService();

    UFUNCTION(BlueprintCallable, Category = "Vortex|Database")
    TObjectPtr<UVortexQueryBuilder> From(const FString& Table);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Database")
    void Insert(const FString& Table, const FString& RowsJson,
        FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Database")
    void ListTables(FVortexResponse OnSuccess, FVortexError OnError);

    UVortexClient* Client = nullptr;
};

UCLASS(BlueprintType, Blueprintable)
class VORTEXTSDK_API UVortexQueryBuilder : public UObject
{
    GENERATED_BODY()
public:
    UVortexQueryBuilder();

    UVortexClient* Client = nullptr;
    FString Table;
    TArray<FString> Filters;
    TArray<FString> OrderBy;
    FString Select;
    int32 Limit = -1;
    int32 Offset = -1;
    bool CountTotal = false;

    UFUNCTION(BlueprintCallable, Category = "Vortex|Database")
    UVortexQueryBuilder* SelectColumns(const FString& Cols);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Database")
    UVortexQueryBuilder* Filter(const FString& Column, const FString& Op, const FString& Value);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Database")
    UVortexQueryBuilder* Limit(int32 N);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Database")
    UVortexQueryBuilder* Offset(int32 N);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Database")
    UVortexQueryBuilder* OrderByColumn(const FString& Column, const FString& Direction = FString("asc"));

    UFUNCTION(BlueprintCallable, Category = "Vortex|Database")
    UVortexQueryBuilder* CountTotal();

    UFUNCTION(BlueprintCallable, Category = "Vortex|Database")
    void Execute(FVortexResponse OnSuccess, FVortexError OnError);
};

UCLASS(BlueprintType, Blueprintable)
class VORTEXTSDK_API UVortexStorageService : public UObject
{
    GENERATED_BODY()
public:
    UVortexStorageService();

    UFUNCTION(BlueprintCallable, Category = "Vortex|Storage")
    void CreateBucket(const FString& Name, bool IsPublic,
        FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Storage")
    void ListBuckets(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Storage")
    void PresignUpload(const FString& Path,
        FVortexResponse OnSuccess, FVortexError OnError);

    UVortexClient* Client = nullptr;
};

UCLASS(BlueprintType, Blueprintable)
class VORTEXTSDK_API UVortexFunctionsService : public UObject
{
    GENERATED_BODY()
public:
    UVortexFunctionsService();

    UFUNCTION(BlueprintCallable, Category = "Vortex|Functions")
    void Deploy(const FString& Name, const FString& Language, const FString& Code,
        const FString& Description, FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Functions")
    void List(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Functions")
    void Invoke(const FString& Name, const FString& DataJson,
        FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Functions")
    void Delete(const FString& Name, FVortexResponse OnSuccess, FVortexError OnError);

    UVortexClient* Client = nullptr;
};

UCLASS(BlueprintType, Blueprintable)
class VORTEXTSDK_API UVortexAppsService : public UObject
{
    GENERATED_BODY()
public:
    UVortexAppsService();

    UFUNCTION(BlueprintCallable, Category = "Vortex|Apps")
    void Create(const FString& Name, const FString& Title, const FString& Description,
        FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Apps")
    void List(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Apps")
    void Delete(const FString& Id, FVortexResponse OnSuccess, FVortexError OnError);

    UVortexClient* Client = nullptr;
};

UCLASS(BlueprintType, Blueprintable)
class VORTEXTSDK_API UVortexBillingService : public UObject
{
    GENERATED_BODY()
public:
    UVortexBillingService();

    UFUNCTION(BlueprintCallable, Category = "Vortex|Billing")
    void Status(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Billing")
    void ListPlans(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Billing")
    void Checkout(const FString& PlanName, const FString& Email,
        const FString& SuccessUrl, const FString& CancelUrl,
        FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Billing")
    void ListTransactions(int32 Limit, FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Billing")
    void GetSubscription(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Billing")
    void CancelSubscription(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Billing")
    void GetMe(FVortexResponse OnSuccess, FVortexError OnError);

    UVortexClient* Client = nullptr;
};

UCLASS(BlueprintType, Blueprintable)
class VORTEXTSDK_API UVortexAdminService : public UObject
{
    GENERATED_BODY()
public:
    UVortexAdminService();

    UFUNCTION(BlueprintCallable, Category = "Vortex|Admin")
    void Sql(const FString& Statement, FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Admin")
    void ListPolicies(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Admin")
    void CreatePolicy(const FString& Table, const FString& PolicyJson,
        FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Admin")
    void ListUsers(FVortexResponse OnSuccess, FVortexError OnError);

    UFUNCTION(BlueprintCallable, Category = "Vortex|Admin")
    void InsightsOverview(FVortexResponse OnSuccess, FVortexError OnError);

    UVortexClient* Client = nullptr;
};

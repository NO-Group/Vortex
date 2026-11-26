package vortex

import "context"

type BillingService struct{ c *Client }

type BillingStatus struct {
	Enabled        bool   `json:"enabled"`
	Gateway        string `json:"gateway"`
	DefaultCurrency string `json:"defaultCurrency"`
}

type CheckoutResult struct {
	TransactionID string `json:"transactionId"`
	Reference     string `json:"reference"`
	Gateway       string `json:"gateway"`
	AmountCents   int    `json:"amountCents"`
	Currency      string `json:"currency"`
	RedirectURL   string `json:"redirectUrl"`
}

func (b *BillingService) Status(ctx context.Context) (*BillingStatus, error) {
	var s BillingStatus
	err := b.c.request(ctx, "GET", "/v1/billing/status", nil, &s)
	return &s, err
}

func (b *BillingService) ListPlans(ctx context.Context) ([]map[string]interface{}, error) {
	var resp struct{ Plans []map[string]interface{} `json:"plans"` }
	err := b.c.request(ctx, "GET", "/v1/billing/plans", nil, &resp)
	return resp.Plans, err
}

func (b *BillingService) Checkout(ctx context.Context, planName, email string, successURL, cancelURL string) (*CheckoutResult, error) {
	body := map[string]string{"planName": planName, "email": email}
	if successURL != "" { body["successUrl"] = successURL }
	if cancelURL != "" { body["cancelUrl"] = cancelURL }
	var result CheckoutResult
	err := b.c.request(ctx, "POST", "/v1/billing/checkout", body, &result)
	return &result, err
}

func (b *BillingService) ListTransactions(ctx context.Context, limit int) ([]map[string]interface{}, error) {
	var resp struct{ Transactions []map[string]interface{} `json:"transactions"` }
	err := b.c.request(ctx, "GET", fmt.Sprintf("/v1/billing/transactions?limit=%d", limit), nil, &resp)
	return resp.Transactions, err
}

func (b *BillingService) GetSubscription(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := b.c.request(ctx, "GET", "/v1/billing/subscription", nil, &result)
	return result, err
}

func (b *BillingService) CancelSubscription(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := b.c.request(ctx, "POST", "/v1/billing/subscription/cancel", nil, &result)
	return result, err
}

func (b *BillingService) GetMe(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := b.c.request(ctx, "GET", "/v1/billing/me", nil, &result)
	return result, err
}

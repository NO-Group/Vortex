package vortex

import "context"

type AdminService struct{ c *Client }

type TableSummary struct {
	Name     string `json:"name"`
	RowCount int    `json:"rowCount"`
}

// SQL runs a raw SQL query (admin only).
func (a *AdminService) SQL(ctx context.Context, statement string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := a.c.request(ctx, "POST", "/v1/sql", map[string]string{"sql": statement}, &result)
	return result, err
}

// ListPolicies returns all table policies.
func (a *AdminService) ListPolicies(ctx context.Context) ([]map[string]interface{}, error) {
	var resp struct {
		Policies []map[string]interface{} `json:"policies"`
	}
	err := a.c.request(ctx, "GET", "/v1/policies", nil, &resp)
	return resp.Policies, err
}

// CreatePolicy creates or replaces a table policy.
func (a *AdminService) CreatePolicy(ctx context.Context, table string, policy map[string]interface{}) error {
	return a.c.request(ctx, "POST", "/v1/policies", map[string]interface{}{
		"table":  table,
		"policy": policy,
	}, nil)
}

// ListUsers returns all users (admin only).
func (a *AdminService) ListUsers(ctx context.Context) ([]User, error) {
	var resp struct {
		Users []User `json:"users"`
	}
	err := a.c.request(ctx, "GET", "/v1/auth/users", nil, &resp)
	return resp.Users, err
}

// InsightsOverview returns a summary of platform activity.
func (a *AdminService) InsightsOverview(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := a.c.request(ctx, "GET", "/v1/insights/overview", nil, &result)
	return result, err
}

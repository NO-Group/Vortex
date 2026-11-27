package vortex

import "context"

type FunctionService struct{ c *Client }

type Function struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Language    string `json:"language"`
	Size        int    `json:"size"`
	CreatedAt   string `json:"createdAt"`
}

// Deploy deploys a new function to the Vortex edge runtime.
func (f *FunctionService) Deploy(ctx context.Context, name, language, code string, description string) (*Function, error) {
	var fn Function
	body := map[string]interface{}{
		"name":        name,
		"language":    language,
		"code":        code,
		"description": description,
	}
	err := f.c.request(ctx, "POST", "/v1/functions", body, &fn)
	return &fn, err
}

// List returns all deployed functions.
func (f *FunctionService) List(ctx context.Context) ([]Function, error) {
	var resp struct {
		Functions []Function `json:"functions"`
	}
	err := f.c.request(ctx, "GET", "/v1/functions", nil, &resp)
	return resp.Functions, err
}

// Invoke calls a deployed function with the given data payload.
func (f *FunctionService) Invoke(ctx context.Context, name string, data map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := f.c.request(ctx, "POST", "/functions/"+name, data, &result)
	return result, err
}

// Get returns a single function by name.
func (f *FunctionService) Get(ctx context.Context, name string) (*Function, error) {
	var fn Function
	err := f.c.request(ctx, "GET", "/v1/functions/"+name, nil, &fn)
	return &fn, err
}

// Delete removes a function by name.
func (f *FunctionService) Delete(ctx context.Context, name string) error {
	return f.c.request(ctx, "DELETE", "/v1/functions/"+name, nil, nil)
}

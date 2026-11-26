// Package vortex provides a Go SDK for Vortex BaaS.
//
// Usage:
//
//	vortex := vortex.New("https://your-vortex.example.com")
//	session, _ := vortex.Auth.Signup(ctx, "user@example.com", "password")
//	notes, _ := vortex.Database.From("notes").Filter("owner_id", "eq", session.User.ID).Limit(10).Execute(ctx)
package vortex

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is the main Vortex SDK entry point.
type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
	Auth    *AuthService
	Database *DatabaseService
	Storage *StorageService
	Functions *FunctionService
	Apps    *AppsService
	Billing *BillingService
	Admin   *AdminService
}

// New creates a new Vortex client.
func New(baseURL string) *Client {
	c := &Client{
		BaseURL: baseURL,
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
	c.Auth = &AuthService{c: c}
	c.Database = &DatabaseService{c: c}
	c.Storage = &StorageService{c: c}
	c.Functions = &FunctionService{c: c}
	c.Apps = &AppsService{c: c}
	c.Billing = &BillingService{c: c}
	c.Admin = &AdminService{c: c}
	return c
}

// SetToken sets the auth token for all subsequent requests.
func (c *Client) SetToken(token string) { c.Token = token }

func (c *Client) request(ctx context.Context, method, path string, body, out interface{}) error {
	var reader io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		var errBody struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		json.NewDecoder(resp.Body).Decode(&errBody)
		return fmt.Errorf("vortex: %s %s: %s", resp.Status, errBody.Error.Code, errBody.Error.Message)
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

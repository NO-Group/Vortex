package vortex

import "context"

type AppsService struct{ c *Client }

type App struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Title      string `json:"title"`
	Description string `json:"description"`
	CreatedAt  string `json:"createdAt"`
}

// Create registers a new app in Vortex.
func (a *AppsService) Create(ctx context.Context, name, title, description string) (*App, error) {
	var app App
	body := map[string]string{
		"name":         name,
		"title":        title,
		"description":  description,
	}
	err := a.c.request(ctx, "POST", "/v1/apps", body, &app)
	return &app, err
}

// List returns all apps.
func (a *AppsService) List(ctx context.Context) ([]App, error) {
	var resp struct {
		Apps []App `json:"apps"`
	}
	err := a.c.request(ctx, "GET", "/v1/apps", nil, &resp)
	return resp.Apps, err
}

// Get returns a single app by ID.
func (a *AppsService) Get(ctx context.Context, id string) (*App, error) {
	var app App
	err := a.c.request(ctx, "GET", "/v1/apps/"+id, nil, &app)
	return &app, err
}

// Delete removes an app by ID.
func (a *AppsService) Delete(ctx context.Context, id string) error {
	return a.c.request(ctx, "DELETE", "/v1/apps/"+id, nil, nil)
}

package vortex

import "context"

type AuthService struct{ c *Client }

type Session struct {
	Token     string `json:"token"`
	ExpiresIn int    `json:"expiresIn"`
	User      User   `json:"user"`
}

type User struct {
	ID       string                 `json:"id"`
	Email    string                 `json:"email"`
	Role     string                 `json:"role"`
	Metadata map[string]interface{} `json:"metadata"`
}

func (a *AuthService) Signup(ctx context.Context, email, password string) (*Session, error) {
	var s Session
	err := a.c.request(ctx, "POST", "/v1/auth/signup", map[string]string{"email": email, "password": password}, &s)
	if err == nil {
		a.c.SetToken(s.Token)
	}
	return &s, err
}

func (a *AuthService) Login(ctx context.Context, email, password string) (*Session, error) {
	var s Session
	err := a.c.request(ctx, "POST", "/v1/auth/login", map[string]string{"email": email, "password": password}, &s)
	if err == nil {
		a.c.SetToken(s.Token)
	}
	return &s, err
}

func (a *AuthService) Me(ctx context.Context) (*User, error) {
	var u User
	err := a.c.request(ctx, "GET", "/v1/auth/me", nil, &u)
	return &u, err
}

func (a *AuthService) ListOAuthProviders(ctx context.Context) ([]string, error) {
	var resp struct {
		Providers []map[string]interface{} `json:"providers"`
	}
	err := a.c.request(ctx, "GET", "/v1/auth/oauth/providers", nil, &resp)
	return resp.Providers, err
}

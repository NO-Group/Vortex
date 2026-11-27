package vortex

import "context"

type VCaptchaService struct{ c *Client }

type VCaptchaChallenge struct {
	ChallengeID    string `json:"challengeId"`
	Mode           string `json:"mode"`
	GridSize       int    `json:"gridSize"`
	CellCount      int    `json:"cellCount"`
	SequenceLength int    `json:"sequenceLength"`
	ExpiresAt      string `json:"expiresAt"`
	PatternName    string `json:"patternName,omitempty"`
}

type VCaptchaVerifyResult struct {
	Valid         bool                  `json:"valid"`
	Message       string                `json:"message"`
	NewChallenge  *VCaptchaChallenge    `json:"newChallenge,omitempty"`
}

type VCaptchaConfig struct {
	ID                  string `json:"id"`
	Enabled             bool   `json:"enabled"`
	DefaultMode         string `json:"default_mode"`
	DefaultGridSize     int    `json:"default_grid_size"`
	DefaultSeqLength    int    `json:"default_sequence_length"`
	TTLSeconds          int    `json:"ttl_seconds"`
	RequireOnSignup     bool   `json:"require_on_signup"`
	RequireOnLogin      bool   `json:"require_on_login"`
	MaxAttempts         int    `json:"max_attempts"`
	UpdatedAt           string `json:"updated_at"`
}

type VCaptchaStats struct {
	Total  int `json:"total"`
	Solved int `json:"solved"`
	Failed int `json:"failed"`
	Expired int `json:"expired"`
	Active int `json:"active"`
}

// Challenge generates a new VCaptcha challenge.
func (v *VCaptchaService) Challenge(ctx context.Context, mode string, gridSize, seqLen int) (*VCaptchaChallenge, error) {
	body := map[string]interface{}{}
	if mode != "" { body["mode"] = mode }
	if gridSize > 0 { body["gridSize"] = gridSize }
	if seqLen > 0 { body["sequenceLength"] = seqLen }
	var ch VCaptchaChallenge
	err := v.c.request(ctx, "POST", "/v1/vcaptcha/challenge", body, &ch)
	return &ch, err
}

// Verify checks a VCaptcha solution.
func (v *VCaptchaService) Verify(ctx context.Context, challengeID string, clicks []int) (*VCaptchaVerifyResult, error) {
	body := map[string]interface{}{
		"challengeId": challengeID,
		"clicks":      clicks,
	}
	var result VCaptchaVerifyResult
	err := v.c.request(ctx, "POST", "/v1/vcaptcha/verify", body, &result)
	return &result, err
}

// GetConfig returns the current VCaptcha configuration.
func (v *VCaptchaService) GetConfig(ctx context.Context) (*VCaptchaConfig, error) {
	var resp struct{ Config VCaptchaConfig `json:"config"` }
	err := v.c.request(ctx, "GET", "/v1/vcaptcha/config", nil, &resp)
	return &resp.Config, err
}

// GetStats returns VCaptcha challenge statistics.
func (v *VCaptchaService) GetStats(ctx context.Context) (*VCaptchaStats, error) {
	var resp struct{ Stats VCaptchaStats `json:"stats"` }
	err := v.c.request(ctx, "GET", "/v1/vcaptcha/stats", nil, &resp)
	return &resp.Stats, err
}

// Cleanup deletes expired challenges.
func (v *VCaptchaService) Cleanup(ctx context.Context) (int, error) {
	var resp struct{ Deleted int `json:"deleted"` }
	err := v.c.request(ctx, "POST", "/v1/vcaptcha/cleanup", nil, &resp)
	return resp.Deleted, err
}

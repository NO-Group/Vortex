package vortex

import "context"

type StorageService struct{ c *Client }

func (s *StorageService) CreateBucket(ctx context.Context, name string, isPublic bool) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := s.c.request(ctx, "POST", "/v1/storage/buckets", map[string]interface{}{"name": name, "isPublic": isPublic}, &result)
	return result, err
}

func (s *StorageService) ListBuckets(ctx context.Context) ([]map[string]interface{}, error) {
	var resp struct{ Buckets []map[string]interface{} `json:"buckets"` }
	err := s.c.request(ctx, "GET", "/v1/storage/buckets", nil, &resp)
	return resp.Buckets, err
}

func (s *StorageService) PresignUpload(ctx context.Context, path string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := s.c.request(ctx, "POST", "/v1/storage/presign-upload", map[string]string{"path": path}, &result)
	return result, err
}

func (s *StorageService) ImageURL(bucket, path string, opts map[string]string) string {
	url := s.c.BaseURL + "/v1/storage/public/" + bucket + "/" + path
	if len(opts) > 0 {
		url += "?"
		first := true
		for k, v := range opts {
			if !first { url += "&" }
			url += k + "=" + v
			first = false
		}
	}
	return url
}

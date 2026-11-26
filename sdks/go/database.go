package vortex

import "context"

type DatabaseService struct{ c *Client }

type Filter struct {
	Column string      `json:"column"`
	Op     string      `json:"op"`
	Value  interface{} `json:"value"`
}

type QueryBuilder struct {
	c       *Client
	table   string
	filters []Filter
	limit   int
	offset  int
	orderBy []map[string]string
	count   bool
	select_ []string
}

type QueryResult struct {
	Rows  []map[string]interface{} `json:"rows"`
	Count int                      `json:"count"`
	Total int                      `json:"total,omitempty"`
}

func (d *DatabaseService) From(table string) *QueryBuilder {
	return &QueryBuilder{c: d.c, table: table}
}

func (q *QueryBuilder) Select(cols ...string) *QueryBuilder { q.select_ = cols; return q }
func (q *QueryBuilder) Filter(column, op string, value interface{}) *QueryBuilder {
	q.filters = append(q.filters, Filter{Column: column, Op: op, Value: value})
	return q
}
func (q *QueryBuilder) Limit(n int) *QueryBuilder   { q.limit = n; return q }
func (q *QueryBuilder) Offset(n int) *QueryBuilder  { q.offset = n; return q }
func (q *QueryBuilder) OrderBy(column, direction string) *QueryBuilder {
	q.orderBy = append(q.orderBy, map[string]string{"column": column, "direction": direction})
	return q
}
func (q *QueryBuilder) CountTotal() *QueryBuilder { q.count = true; return q }

func (q *QueryBuilder) Execute(ctx context.Context) (*QueryResult, error) {
	body := map[string]interface{}{"filters": q.filters}
	if q.count { body["countTotal"] = true }
	if len(q.select_) > 0 { body["select"] = q.select_ }
	if q.limit > 0 { body["limit"] = q.limit }
	if q.offset > 0 { body["offset"] = q.offset }
	if len(q.orderBy) > 0 { body["orderBy"] = q.orderBy }
	var result QueryResult
	err := q.c.request(ctx, "POST", "/v1/db/"+q.table+"/query", body, &result)
	return &result, err
}

func (d *DatabaseService) Insert(ctx context.Context, table string, rows []map[string]interface{}) (*QueryResult, error) {
	var result QueryResult
	err := d.c.request(ctx, "POST", "/v1/db/"+table, map[string]interface{}{"rows": rows}, &result)
	return &result, err
}

func (d *DatabaseService) ListTables(ctx context.Context) ([]string, error) {
	var resp struct{ Tables []string `json:"tables"` }
	err := d.c.request(ctx, "GET", "/v1/db/tables", nil, &resp)
	return resp.Tables, err
}

import '../core/vortex_client.dart';

/// Full-text Search client — `/v1/search/fulltext`.
///
/// PostgreSQL native keyword search using GIN indexes and to_tsvector.
/// No embeddings, no external services — pure database full-text search.
class SearchService {
  final VortexClient _client;

  SearchService(this._client);

  /// Create a full-text GIN index on the specified table columns.
  Future<Map<String, dynamic>> createIndex({
    required String name,
    required String tableName,
    required List<String> columns,
    String? language,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/search/fulltext/index',
      body: {
        'name': name,
        'tableName': tableName,
        'columns': columns,
        if (language != null) 'language': language,
      },
    );
  }

  /// List all full-text indexes.
  Future<List<Map<String, dynamic>>> listIndexes() async {
    final body = await _client.sendJson('GET', '/v1/search/fulltext/index');
    return (body['indexes'] as List).cast<Map<String, dynamic>>();
  }

  /// Drop a full-text index.
  Future<void> dropIndex(String name) async {
    await _client.sendJson('DELETE', '/v1/search/fulltext/index/$name');
  }

  /// Search a table using full-text query.
  ///
  /// [query] supports boolean operators (AND, OR, NOT) when mode is 'match',
  /// or natural language when mode is 'plain'.
  Future<Map<String, dynamic>> fulltext({
    required String tableName,
    required String query,
    List<String>? columns,
    String? language,
    int? limit,
    String? mode, // 'match' | 'plain'
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/search/fulltext',
      body: {
        'tableName': tableName,
        'query': query,
        if (columns != null) 'columns': columns,
        if (language != null) 'language': language,
        if (limit != null) 'limit': limit,
        if (mode != null) 'mode': mode,
      },
    );
  }
}

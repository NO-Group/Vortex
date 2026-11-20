import '../core/vortex_client.dart';

/// Vector search client — `/v1/vector`.
class VectorService {
  final VortexClient _client;

  VectorService(this._client);

  /// Create a vector collection.
  Future<Map<String, dynamic>> createCollection({
    required String name,
    String? description,
    required int dimensions,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/vector/collections',
      body: {
        'name': name,
        if (description != null) 'description': description,
        'dimensions': dimensions,
      },
    );
  }

  /// List vector collections.
  Future<List<Map<String, dynamic>>> listCollections() async {
    final body = await _client.sendJson('GET', '/v1/vector/collections');
    return (body['collections'] as List).cast<Map<String, dynamic>>();
  }

  /// Delete a vector collection.
  Future<void> deleteCollection(String collectionId) async {
    await _client.sendJson('DELETE', '/v1/vector/collections/$collectionId');
  }

  /// Insert a vector into a collection.
  Future<Map<String, dynamic>> insert(String collectionId, {
    required String itemId,
    required List<double> vector,
    Map<String, dynamic>? payload,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/vector/collections/$collectionId/items',
      body: {
        'itemId': itemId,
        'vector': vector,
        if (payload != null) 'payload': payload,
      },
    );
  }

  /// Upsert a vector (insert or update by item_id).
  Future<Map<String, dynamic>> upsert(String collectionId, {
    required String itemId,
    required List<double> vector,
    Map<String, dynamic>? payload,
  }) async {
    return _client.sendJson(
      'PATCH',
      '/v1/vector/collections/$collectionId/items',
      body: {
        'itemId': itemId,
        'vector': vector,
        if (payload != null) 'payload': payload,
      },
    );
  }

  /// Delete a vector from a collection.
  Future<void> delete(String collectionId, String itemId) async {
    await _client.sendJson(
      'DELETE',
      '/v1/vector/collections/$collectionId/items/$itemId',
    );
  }

  /// List vectors in a collection.
  Future<List<Map<String, dynamic>>> list(String collectionId, {int? limit}) async {
    final path = limit != null
        ? '/v1/vector/collections/$collectionId/items?limit=$limit'
        : '/v1/vector/collections/$collectionId/items';
    final body = await _client.sendJson('GET', path);
    return (body['items'] as List).cast<Map<String, dynamic>>();
  }

  /// Search for similar vectors using cosine similarity.
  Future<List<Map<String, dynamic>>> search(String collectionId, List<double> queryVector, {
    int? limit,
    Map<String, dynamic>? filter,
  }) async {
    final body = await _client.sendJson(
      'POST',
      '/v1/vector/collections/$collectionId/search',
      body: {
        'vector': queryVector,
        if (limit != null) 'limit': limit,
        if (filter != null) 'filter': filter,
      },
    );
    return (body['results'] as List).cast<Map<String, dynamic>>();
  }
}

/// Query model types for the Vortex database gateway.
library;

/// Comparison operators supported by the dynamic query engine.
class FilterOp {
  static const String eq = 'eq';
  static const String neq = 'neq';
  static const String gt = 'gt';
  static const String gte = 'gte';
  static const String lt = 'lt';
  static const String lte = 'lte';
  static const String like = 'like';
  static const String inList = 'in';
  static const String isNull = 'is';

  FilterOp._();
}

/// A single filter predicate (`column <op> value`).
class QueryFilter {
  final String column;
  final String op;
  final dynamic value;

  const QueryFilter(this.column, this.op, this.value);

  Map<String, dynamic> toJson() => {
        'column': column,
        'op': op,
        'value': value,
      };
}

/// Sort order for a query.
class QueryOrder {
  final String column;
  final String direction;

  const QueryOrder(this.column, {this.direction = 'asc'});

  Map<String, dynamic> toJson() => {
        'column': column,
        'direction': direction,
      };
}

/// Result set returned by the database gateway.
class QueryResult {
  final List<Map<String, dynamic>> rows;
  final int count;

  const QueryResult({required this.rows, required this.count});

  factory QueryResult.fromJson(Map<String, dynamic> json) {
    final rawRows = (json['rows'] as List<dynamic>? ?? const []);
    return QueryResult(
      rows: rawRows
          .map((r) => Map<String, dynamic>.from(r as Map))
          .toList(growable: false),
      count: (json['count'] as num?)?.toInt() ?? rawRows.length,
    );
  }
}

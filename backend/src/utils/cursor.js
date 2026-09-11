/**
 * Cursor-based pagination utilities.
 * Cursor encodes { created_at, id } for stable DESC ordering.
 */

export function encodeCursor(row) {
  if (!row) return null
  const payload = {
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
    id: String(row.id),
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeCursor(cursor) {
  if (!cursor) return null
  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (!payload.created_at || !payload.id) return null
    return payload
  } catch {
    return null
  }
}

export function clampLimit(limit, max = 100, defaultLimit = 20) {
  const n = parseInt(limit, 10)
  if (Number.isNaN(n) || n < 1) return defaultLimit
  return Math.min(n, max)
}

/**
 * Build WHERE clause for cursor pagination (DESC sort).
 * Returns { clause, params }
 */
export function buildCursorClause(cursor, tableAlias = '') {
  const decoded = decodeCursor(cursor)
  if (!decoded) return { clause: '', params: [] }

  const prefix = tableAlias ? `${tableAlias}.` : ''
  return {
    clause: `AND (${prefix}created_at < ? OR (${prefix}created_at = ? AND ${prefix}id < ?))`,
    params: [decoded.created_at, decoded.created_at, decoded.id],
  }
}

/**
 * Format paginated response.
 */
export function paginatedResponse(data, limit, fetchLimit) {
  const hasMore = data.length > limit
  const items = hasMore ? data.slice(0, limit) : data
  const lastItem = items[items.length - 1]

  return {
    data: items,
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: hasMore && lastItem ? encodeCursor(lastItem) : null,
    },
  }
}

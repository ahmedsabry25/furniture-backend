// Reads ?page and ?limit safely: limit is capped at 50
exports.getPagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

exports.meta = (page, limit, total) => ({ page, limit, total, pages: Math.ceil(total / limit) });

// Escapes user text before using it inside a RegExp (prevents regex injection)
exports.escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
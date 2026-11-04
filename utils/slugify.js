// Works with Arabic and English: "Office Chair" -> "office-chair"
module.exports = (text) =>
  String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
// Takes only the allowed fields from the request body
module.exports = (obj = {}, keys = []) =>
  keys.reduce((acc, key) => (obj[key] !== undefined ? { ...acc, [key]: obj[key] } : acc), {});
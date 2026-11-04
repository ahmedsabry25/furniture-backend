const EGYPT_MOBILE_REGEX = /^01[0125]\d{8}$/;

// Normalizes to the 01XXXXXXXXX format
// Accepts: +20..., 0020..., 20..., spaces, dashes, Arabic-Indic digits
function normalizePhone(value) {
  let s = String(value || '').replace(/[\s\-()]/g, '');
  s = s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  if (s.startsWith('+20')) s = '0' + s.slice(3);
  else if (s.startsWith('0020')) s = '0' + s.slice(4);
  else if (s.startsWith('20') && s.length === 12) s = '0' + s.slice(2);
  return s;
}

module.exports = { EGYPT_MOBILE_REGEX, normalizePhone };
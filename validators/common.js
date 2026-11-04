const { body, param } = require('express-validator');
const { normalizePhone, EGYPT_MOBILE_REGEX } = require('../utils/phone');

// Reusable: required string field
const requiredString = (field, label) =>
  body(field)
    .exists({ values: 'null' }).withMessage(`${label} is required`).bail()
    .isString().withMessage(`${label} must be a string`).bail();

const phone = (field = 'phone') =>
  requiredString(field, 'Phone')
    .customSanitizer(normalizePhone)
    .matches(EGYPT_MOBILE_REGEX).withMessage('Invalid Egyptian mobile number');

const password = (field = 'password') =>
  requiredString(field, 'Password')
    .isLength({ min: 8, max: 72 }).withMessage('Password must be 8 to 72 characters');

const mongoIdParam = (name = 'id') =>
  param(name).isMongoId().withMessage(`Invalid ${name}`);

// Optional bilingual text: { ar, en }. Send null to clear it
const localizedText = (field, max = 200) => [
  body(field).optional({ values: 'null' }).isObject()
    .withMessage(`${field} must be an object (or null to clear it)`),
  body(`${field}.ar`).if(body(field).isObject())
    .isString().withMessage(`${field}.ar is required`).bail()
    .trim().isLength({ min: 1, max }).withMessage(`${field}.ar must be 1 to ${max} characters`),
  body(`${field}.en`).if(body(field).isObject())
    .optional({ values: 'falsy' }).isString().trim().isLength({ max })
    .withMessage(`${field}.en must be up to ${max} characters`),
];

module.exports = { requiredString, phone, password, mongoIdParam, localizedText };
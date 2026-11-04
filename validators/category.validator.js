const { body } = require('express-validator');

const SLUG_REGEX = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

// Fields allowed on both create and update
const optionalFields = [
  body('name.en').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 })
    .withMessage('English name must be up to 100 characters'),
  body('slug').optional().isString().trim().toLowerCase()
    .matches(SLUG_REGEX).withMessage('Slug can contain letters, numbers and dashes only'),
  body('description').optional().isObject().withMessage('Description must be an object'),
  body('description.ar').if(body('description').exists()).isString().trim().isLength({ min: 1, max: 500 })
    .withMessage('Arabic description must be 1 to 500 characters'),
  body('description.en').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 })
    .withMessage('English description must be up to 500 characters'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('sortOrder must be 0 or more').toInt(),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  body('showInNavbar').optional().isBoolean().withMessage('showInNavbar must be true or false').toBoolean(),
];

exports.createCategoryRules = [
  body('name').isObject().withMessage('Name is required'),
  body('name.ar').isString().withMessage('Arabic name is required').bail()
    .trim().isLength({ min: 2, max: 100 }).withMessage('Arabic name must be 2 to 100 characters'),
  ...optionalFields,
];

exports.updateCategoryRules = [
  body('name').optional().isObject().withMessage('Name must be an object'),
  body('name.ar').if(body('name').exists()).isString().withMessage('Arabic name is required').bail()
    .trim().isLength({ min: 2, max: 100 }).withMessage('Arabic name must be 2 to 100 characters'),
  ...optionalFields,
];

exports.reorderRules = [
  body('items').isArray({ min: 1, max: 200 }).withMessage('items must be a list of 1 to 200 entries'),
  body('items.*.id').isMongoId().withMessage('Each item needs a valid id'),
  body('items.*.sortOrder').isInt({ min: 0 }).withMessage('Each item needs sortOrder (0 or more)').toInt(),
];
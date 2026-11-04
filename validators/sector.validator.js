const { body } = require('express-validator');

const SLUG_REGEX = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
const KEY_REGEX = /^[a-z][a-zA-Z0-9_]*$/;
const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'multiselect', 'boolean'];
const OPTION_TYPES = ['select', 'multiselect'];

// Rules for the form fields list (used on create and update)
const formFieldsRules = [
  body('formFields').optional().isArray({ max: 40 })
    .withMessage('formFields must be a list of up to 40 fields'),

  body('formFields.*.key').isString().withMessage('Each field needs a key').bail()
    .matches(KEY_REGEX).withMessage('Field key must start with a lowercase letter and contain letters, numbers or _ only'),
  body('formFields.*.label.ar').isString().withMessage('Each field needs an Arabic label').bail()
    .trim().isLength({ min: 1, max: 100 }).withMessage('Arabic label must be 1 to 100 characters'),
  body('formFields.*.label.en').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 })
    .withMessage('English label must be up to 100 characters'),
  body('formFields.*.fieldType').isIn(FIELD_TYPES)
    .withMessage(`fieldType must be one of: ${FIELD_TYPES.join(', ')}`),
  body('formFields.*.isRequired').optional().isBoolean().withMessage('isRequired must be true or false').toBoolean(),
  body('formFields.*.sortOrder').optional().isInt({ min: 0 }).withMessage('Field sortOrder must be 0 or more').toInt(),
  body('formFields.*.maxLength').optional().isInt({ min: 1, max: 2000 })
    .withMessage('maxLength must be between 1 and 2000').toInt(),
  body('formFields.*.min').optional().isFloat().withMessage('min must be a number').toFloat(),
  body('formFields.*.max').optional().isFloat().withMessage('max must be a number').toFloat(),

  body('formFields.*.options').optional().isArray({ max: 50 })
    .withMessage('options must be a list of up to 50 items'),
  body('formFields.*.options.*.value').isString().withMessage('Each option needs a value').bail()
    .trim().isLength({ min: 1, max: 100 }).withMessage('Option value must be 1 to 100 characters'),
  body('formFields.*.options.*.label.ar').isString().withMessage('Each option needs an Arabic label').bail()
    .trim().isLength({ min: 1, max: 100 }).withMessage('Option label must be 1 to 100 characters'),
  body('formFields.*.options.*.label.en').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 })
    .withMessage('English option label must be up to 100 characters'),

  // Rules that depend on more than one field. Keep this last
  body('formFields').optional().custom((fields) => {
    if (!Array.isArray(fields)) return true; // already reported above
    const keys = new Set();

    for (const field of fields) {
      if (!field || typeof field !== 'object') continue;

      if (keys.has(field.key)) throw new Error(`Duplicate field key "${field.key}"`);
      keys.add(field.key);

      if (OPTION_TYPES.includes(field.fieldType) && !(Array.isArray(field.options) && field.options.length)) {
        throw new Error(`Field "${field.key}" needs at least one option`);
      }
      if (field.min != null && field.max != null && Number(field.min) > Number(field.max)) {
        throw new Error(`Field "${field.key}": min cannot be greater than max`);
      }
    }
    return true;
  }),
];

// Fields allowed on both create and update
const commonRules = [
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
  ...formFieldsRules,
];

exports.createSectorRules = [
  body('name').isObject().withMessage('Name is required'),
  body('name.ar').isString().withMessage('Arabic name is required').bail()
    .trim().isLength({ min: 2, max: 100 }).withMessage('Arabic name must be 2 to 100 characters'),
  ...commonRules,
];

exports.updateSectorRules = [
  body('name').optional().isObject().withMessage('Name must be an object'),
  body('name.ar').if(body('name').exists()).isString().withMessage('Arabic name is required').bail()
    .trim().isLength({ min: 2, max: 100 }).withMessage('Arabic name must be 2 to 100 characters'),
  ...commonRules,
];
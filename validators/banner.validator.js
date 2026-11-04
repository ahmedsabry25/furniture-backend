const { body } = require('express-validator');
const { localizedText } = require('./common');

const LINK_TYPES = ['none', 'product', 'category', 'sector', 'fitout', 'url'];

// Fields shared by create and update
const commonRules = [
  ...localizedText('subtitle', 200),
  ...localizedText('buttonText', 40),

  body('linkType').optional().isIn(LINK_TYPES).withMessage(`linkType must be one of: ${LINK_TYPES.join(', ')}`),
  body('linkValue').optional({ values: 'null' }).isString().trim().isLength({ max: 300 })
    .withMessage('linkValue must be up to 300 characters'),

  body('sortOrder').optional().isInt({ min: 0 }).withMessage('sortOrder must be 0 or more').toInt(),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  body('startsAt').optional({ values: 'null' }).isISO8601().withMessage('startsAt must be a valid date'),
  body('endsAt').optional({ values: 'null' }).isISO8601().withMessage('endsAt must be a valid date'),
];

exports.createBannerRules = [
  body('title').isObject().withMessage('Title is required'),
  body('title.ar').isString().withMessage('Arabic title is required').bail()
    .trim().isLength({ min: 2, max: 120 }).withMessage('Arabic title must be 2 to 120 characters'),
  body('title.en').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 })
    .withMessage('English title must be up to 120 characters'),
  ...commonRules,
];

exports.updateBannerRules = [
  body('title').optional().isObject().withMessage('Title must be an object'),
  body('title.ar').if(body('title').exists()).isString().withMessage('Arabic title is required').bail()
    .trim().isLength({ min: 2, max: 120 }).withMessage('Arabic title must be 2 to 120 characters'),
  body('title.en').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 })
    .withMessage('English title must be up to 120 characters'),
  ...commonRules,
];
const { body, query } = require('express-validator');

const SLUG_REGEX = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
const SKU_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;
const MAX_MONEY = 1000000000; // 10 million EGP, in piasters
const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc', 'name'];

// A list of bilingual items: materials, finishes, components
const localizedList = (field) => [
    body(field).optional().isArray({ max: 30 }).withMessage(`${field} must be a list of up to 30 items`),
    body(`${field}.*.ar`).isString().withMessage(`Each ${field} item needs Arabic text`).bail()
        .trim().isLength({ min: 1, max: 200 }).withMessage(`${field} text must be 1 to 200 characters`),
    body(`${field}.*.en`).optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 })
        .withMessage(`English ${field} text must be up to 200 characters`),
];

// Fields shared by create and update
const commonRules = [
    body('name.en').optional({ values: 'falsy' }).isString().trim().isLength({ max: 150 })
        .withMessage('English name must be up to 150 characters'),
    body('slug').optional().isString().trim().toLowerCase()
        .matches(SLUG_REGEX).withMessage('Slug can contain letters, numbers and dashes only'),

    body('description').optional().isObject().withMessage('Description must be an object'),
    body('description.ar').if(body('description').exists()).isString().trim().isLength({ min: 1, max: 2000 })
        .withMessage('Arabic description must be 1 to 2000 characters'),
    body('description.en').optional({ values: 'falsy' }).isString().trim().isLength({ max: 2000 })
        .withMessage('English description must be up to 2000 characters'),

    body('sectors').optional().isArray({ max: 30 }).withMessage('sectors must be a list of up to 30 ids'),
    body('sectors.*').isMongoId().withMessage('Each sector must be a valid id'),

    // null clears the discount
    body('discountPrice').optional({ values: 'null' }).isInt({ min: 1, max: MAX_MONEY })
        .withMessage('discountPrice must be a whole number of piasters').toInt(),
    body('discountStartsAt').optional({ values: 'null' }).isISO8601().withMessage('discountStartsAt must be a valid date'),
    body('discountEndsAt').optional({ values: 'null' }).isISO8601().withMessage('discountEndsAt must be a valid date'),

    body('stock').optional().isInt({ min: 0, max: 1000000 }).withMessage('stock must be a whole number, 0 or more').toInt(),
    body('status').optional().isIn(['active', 'inactive']).withMessage('status must be active or inactive'),
    body('maxQtyPerOrder').optional().isInt({ min: 1, max: 100 }).withMessage('maxQtyPerOrder must be 1 to 100').toInt(),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be true or false').toBoolean(),

    body('dimensions').optional().isObject().withMessage('dimensions must be an object'),
    body('dimensions.length').optional().isFloat({ min: 0 }).withMessage('length must be 0 or more').toFloat(),
    body('dimensions.width').optional().isFloat({ min: 0 }).withMessage('width must be 0 or more').toFloat(),
    body('dimensions.height').optional().isFloat({ min: 0 }).withMessage('height must be 0 or more').toFloat(),
    body('dimensions.unit').optional().isIn(['mm', 'cm', 'm']).withMessage('unit must be mm, cm or m'),

    ...localizedList('materials'),
    ...localizedList('finishes'),
    ...localizedList('components'),

    body('specifications').optional().isArray({ max: 40 }).withMessage('specifications must be a list of up to 40 items'),
    body('specifications.*.label.ar').isString().withMessage('Each specification needs an Arabic label').bail()
        .trim().isLength({ min: 1, max: 100 }).withMessage('Specification label must be 1 to 100 characters'),
    body('specifications.*.label.en').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 })
        .withMessage('English specification label must be up to 100 characters'),
    body('specifications.*.value.ar').isString().withMessage('Each specification needs an Arabic value').bail()
        .trim().isLength({ min: 1, max: 300 }).withMessage('Specification value must be 1 to 300 characters'),
    body('specifications.*.value.en').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 })
        .withMessage('English specification value must be up to 300 characters'),

    // Needs two fields at once. Keep it last (price is sanitized before it)
    body('discountPrice').custom((value, { req }) => {
        if (value != null && req.body.price != null && Number(value) >= Number(req.body.price)) {
            throw new Error('discountPrice must be lower than price');
        }
        return true;
    }),
];

exports.createProductRules = [
    body('name').isObject().withMessage('Name is required'),
    body('name.ar').isString().withMessage('Arabic name is required').bail()
        .trim().isLength({ min: 2, max: 150 }).withMessage('Arabic name must be 2 to 150 characters'),
    body('sku').isString().withMessage('SKU is required').bail()
        .trim().matches(SKU_REGEX).withMessage('SKU must be 2 to 40 characters: letters, numbers, dot, dash or underscore')
        .customSanitizer((value) => value.toUpperCase()),
    body('category').isMongoId().withMessage('A valid category id is required'),
    body('price').isInt({ min: 1, max: MAX_MONEY })
        .withMessage('Price is required as a whole number of piasters (15000 = 150 EGP)').toInt(),
    ...commonRules,
];

exports.updateProductRules = [
    body('name').optional().isObject().withMessage('Name must be an object'),
    body('name.ar').if(body('name').exists()).isString().withMessage('Arabic name is required').bail()
        .trim().isLength({ min: 2, max: 150 }).withMessage('Arabic name must be 2 to 150 characters'),
    body('sku').optional().isString().trim().matches(SKU_REGEX)
        .withMessage('SKU must be 2 to 40 characters: letters, numbers, dot, dash or underscore')
        .customSanitizer((value) => value.toUpperCase()),
    body('category').optional().isMongoId().withMessage('category must be a valid id'),
    body('price').optional().isInt({ min: 1, max: MAX_MONEY })
        .withMessage('Price must be a whole number of piasters').toInt(),
    ...commonRules,
];

// PATCH /:id/stock: send exactly one of "stock" (set) or "change" (add / subtract)
exports.stockRules = [
    body('stock').optional().isInt({ min: 0, max: 1000000 }).withMessage('stock must be a whole number, 0 or more').toInt(),
    body('change').optional().isInt({ min: -1000000, max: 1000000 }).withMessage('change must be a whole number').toInt(),
    body().custom((value, { req }) => {
        const data = req.body || {};
        if ((data.stock !== undefined) === (data.change !== undefined)) {
            throw new Error('Send exactly one of "stock" or "change"');
        }
        return true;
    }),
];

// Query rules only validate (no sanitizers: Express 5 query object is read-only)
const listQuery = [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1 to 50'),
    query('q').optional().isString().isLength({ max: 100 }).withMessage('q must be up to 100 characters'),
    query('minPrice').optional().isInt({ min: 0 }).withMessage('minPrice must be a whole number'),
    query('maxPrice').optional().isInt({ min: 0 }).withMessage('maxPrice must be a whole number'),
    query('sort').optional().isIn(SORT_OPTIONS).withMessage(`sort must be one of: ${SORT_OPTIONS.join(', ')}`),
];

exports.publicListRules = [
    ...listQuery,
    query('category').optional().isString().isLength({ max: 200 }).withMessage('category must be a slug'),
    query('sector').optional().isString().isLength({ max: 200 }).withMessage('sector must be a slug'),
    query('inStock').optional().isBoolean().withMessage('inStock must be true or false'),
    query('featured').optional().isBoolean().withMessage('featured must be true or false'),
      query('onSale').optional().isBoolean().withMessage('onSale must be true or false'),
];

exports.adminListRules = [
    ...listQuery,
    query('category').optional().isMongoId().withMessage('category must be a valid id'),
    query('sector').optional().isMongoId().withMessage('sector must be a valid id'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('status must be active or inactive'),
    query('lowStock').optional().isInt({ min: 0 }).withMessage('lowStock must be 0 or more'),
];
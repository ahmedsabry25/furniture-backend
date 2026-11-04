const { body } = require('express-validator');

exports.addItemRules = [
  body('productId').isMongoId().withMessage('productId must be a valid id'),
  body('quantity').optional().isInt({ min: 1, max: 100 }).withMessage('quantity must be 1 to 100').toInt(),
];

exports.updateItemRules = [
  body('quantity').isInt({ min: 1, max: 100 }).withMessage('quantity must be 1 to 100').toInt(),
];
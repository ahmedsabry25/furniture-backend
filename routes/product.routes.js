const router = require('express').Router();
const { param } = require('express-validator');

const product = require('../controllers/product.controller');
const validate = require('../middlewares/validate');
const { protect, allowedTo } = require('../controllers/auth.controller');
const { mongoIdParam } = require('../validators/common');
const {
  createProductRules,
  updateProductRules,
  stockRules,
  publicListRules,
  adminListRules,
} = require('../validators/product.validator');
const { uploadMany, checkImageContent } = require('../middlewares/upload');

const slugParam = param('slug').isString().trim().notEmpty().withMessage('Slug is required');
const adminOnly = [protect, allowedTo('admin')];

// Public
router.get('/', publicListRules, validate, product.listPublic);

// Admin. Note: fixed paths ('/admin') must come before '/:slug'
router.get('/admin', adminOnly, adminListRules, validate, product.listAdmin);
router.get('/admin/:id', adminOnly, mongoIdParam(), validate, product.getOne);
router.post('/', adminOnly, createProductRules, validate, product.create);

// Public: one product by slug
router.get('/:slug', slugParam, validate, product.getBySlug);

router.patch('/:id', adminOnly, mongoIdParam(), updateProductRules, validate, product.update);
router.delete('/:id', adminOnly, mongoIdParam(), validate, product.remove);
router.patch('/:id/stock', adminOnly, mongoIdParam(), stockRules, validate, product.updateStock);

// Images: validate the ids BEFORE accepting the files
router.post('/:id/images',adminOnly,mongoIdParam(),validate,uploadMany('images', 10),checkImageContent,product.addImages);
router.delete('/:id/images/:imageId', adminOnly, mongoIdParam(), mongoIdParam('imageId'), validate, product.removeImage);
router.patch('/:id/images/:imageId/main', adminOnly, mongoIdParam(), mongoIdParam('imageId'), validate, product.setMainImage);

module.exports = router;
const router = require('express').Router();
const { param } = require('express-validator');

const sector = require('../controllers/sector.controller');
const validate = require('../middlewares/validate');
const { protect, allowedTo } = require('../controllers/auth.controller');
const { mongoIdParam } = require('../validators/common');
const { createSectorRules, updateSectorRules } = require('../validators/sector.validator');
const { reorderRules } = require('../validators/category.validator');
const { uploadSingle, checkImageContent } = require('../middlewares/upload');

const uploadSectorImage = uploadSingle('image');
const slugParam = param('slug').isString().trim().notEmpty().withMessage('Slug is required');

// Public
router.get('/', sector.listPublic);

// Admin only. Note: fixed paths ('/admin', '/reorder') must come before '/:slug'
router.get('/admin', protect, allowedTo('admin'), sector.listAdmin);
router.get('/admin/:id', protect, allowedTo('admin'), mongoIdParam(), validate, sector.getOne);
router.post('/', protect, allowedTo('admin'), createSectorRules, validate, sector.create);
router.patch('/reorder', protect, allowedTo('admin'), reorderRules, validate, sector.reorder);

// Public: one sector with its form fields
router.get('/:slug', slugParam, validate, sector.getBySlug);

router.patch('/:id', protect, allowedTo('admin'), mongoIdParam(), updateSectorRules, validate, sector.update);
router.delete('/:id', protect, allowedTo('admin'), mongoIdParam(), validate, sector.remove);

router.post(
  '/:id/image',
  protect, allowedTo('admin'),
  mongoIdParam(), validate,
  uploadSectorImage,
  checkImageContent,
  sector.setImage
);
router.delete('/:id/image', protect, allowedTo('admin'), mongoIdParam(), validate, sector.removeImage);

module.exports = router;
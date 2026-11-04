const router = require('express').Router();
const category = require('../controllers/category.controller');
const validate = require('../middlewares/validate');
const { protect, allowedTo } = require('../controllers/auth.controller');
const { mongoIdParam } = require('../validators/common');
const {
  createCategoryRules,
  updateCategoryRules,
  reorderRules,
} = require('../validators/category.validator');
const { uploadSingle, checkImageContent } = require('../middlewares/upload');

const uploadCategoryImage = uploadSingle('image');

// Public
router.get('/', category.listPublic);

// Admin only. Note: fixed paths ('/admin', '/reorder') must come before '/:id'
router.get('/admin', protect, allowedTo('admin'), category.listAdmin);
router.post('/', protect, allowedTo('admin'), createCategoryRules, validate, category.create);
router.patch('/reorder', protect, allowedTo('admin'), reorderRules, validate, category.reorder);

router.get('/:id', protect, allowedTo('admin'), mongoIdParam(), validate, category.getOne);
router.patch('/:id', protect, allowedTo('admin'), mongoIdParam(), updateCategoryRules, validate, category.update);
router.delete('/:id', protect, allowedTo('admin'), mongoIdParam(), validate, category.remove);

router.post('/:id/image',protect, allowedTo('admin'),mongoIdParam(), validate,uploadCategoryImage,checkImageContent,category.setImage);
router.delete('/:id/image', protect, allowedTo('admin'), mongoIdParam(), validate, category.removeImage);

module.exports = router;
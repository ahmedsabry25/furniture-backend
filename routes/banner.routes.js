const router = require('express').Router();
const banner = require('../controllers/banner.controller');
const validate = require('../middlewares/validate');
const { protect, allowedTo } = require('../controllers/auth.controller');
const { mongoIdParam } = require('../validators/common');
const { createBannerRules, updateBannerRules } = require('../validators/banner.validator');
const { reorderRules } = require('../validators/category.validator');
const { uploadSingle, checkImageContent } = require('../middlewares/upload');

// Every banner route is admin only (visitors get banners from GET /api/home)
router.use(protect, allowedTo('admin'));

router.get('/', banner.list);
router.post('/', createBannerRules, validate, banner.create);
router.patch('/reorder', reorderRules, validate, banner.reorder); // before '/:id'

router.get('/:id', mongoIdParam(), validate, banner.getOne);
router.patch('/:id', mongoIdParam(), updateBannerRules, validate, banner.update);
router.delete('/:id', mongoIdParam(), validate, banner.remove);
router.post('/:id/image', mongoIdParam(), validate, uploadSingle('image'), checkImageContent, banner.setImage);

module.exports = router;
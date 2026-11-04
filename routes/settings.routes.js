const router = require('express').Router();
const settings = require('../controllers/settings.controller');
const validate = require('../middlewares/validate');
const { protect, allowedTo } = require('../controllers/auth.controller');
const { updateSettingsRules } = require('../validators/settings.validator');
const { uploadSingle, checkImageContent } = require('../middlewares/upload');

const adminOnly = [protect, allowedTo('admin')];

router.get('/', settings.get); // public: the frontend needs it for the top bar and footer
router.patch('/', adminOnly, updateSettingsRules, validate, settings.update);
router.post('/logo', adminOnly, uploadSingle('image'), checkImageContent, settings.setLogo);
router.delete('/logo', adminOnly, settings.removeLogo);

module.exports = router;
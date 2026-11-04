const router = require('express').Router();
const rateLimit = require('express-rate-limit');

const cart = require('../controllers/cart.controller');
const validate = require('../middlewares/validate');
const { protect, optionalAuth } = require('../controllers/auth.controller');
const { mongoIdParam } = require('../validators/common');
const { addItemRules, updateItemRules } = require('../validators/cart.validator');

// Visitors can create carts without logging in, so we limit how fast they can do it
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, slow down' },
  })
);

router.get('/', optionalAuth, cart.get);
router.post('/items', optionalAuth, addItemRules, validate, cart.addItem);
router.patch('/items/:productId', optionalAuth, mongoIdParam('productId'), updateItemRules, validate, cart.updateItem);
router.delete('/items/:productId', optionalAuth, mongoIdParam('productId'), validate, cart.removeItem);
router.delete('/', optionalAuth, cart.clear);

// Logged in only
router.post('/merge', protect, cart.merge);

module.exports = router;
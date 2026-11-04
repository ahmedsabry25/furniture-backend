const router = require('express').Router();
const rateLimit = require('express-rate-limit');

const auth = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const {
  signupRules,
  loginRules,
  changePasswordRules,
  forgotPasswordRules,
  verifyResetCodeRules,
  resetPasswordRules,
} = require('../validators/auth.validator');

const limiterOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, try again later' },
};

// Brute-force protection for login / signup / change-password (not for /me)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, ...limiterOptions });

// Stricter limit for the reset flow (email sending + code guessing)
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, ...limiterOptions });

router.post('/signup', authLimiter, signupRules, validate, auth.signup);
router.post('/login', authLimiter, loginRules, validate, auth.login);
router.get('/me', auth.protect, auth.getMe);
router.patch('/change-password', authLimiter, auth.protect, changePasswordRules, validate, auth.changeMyPassword);

router.post('/forgot-password', resetLimiter, forgotPasswordRules, validate, auth.forgotPassword);
router.post('/verify-reset-code', resetLimiter, verifyResetCodeRules, validate, auth.verifyResetCode);
router.post('/reset-password', resetLimiter, resetPasswordRules, validate, auth.resetPassword);

module.exports = router;
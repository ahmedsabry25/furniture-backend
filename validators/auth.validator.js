
const { check } = require('express-validator');
const { requiredString, phone, password } = require('./common');

// Validate email
const email = (field = 'email') =>
  check(field)
    .notEmpty()
    .withMessage('Email is required')
    .bail()
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Invalid email address');

// Signup validation
exports.signupRules = [
  check('name')
    .notEmpty()
    .withMessage('Name is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Name must be 2 to 80 characters'),

  phone(),

  password(),

  check('email')
    .optional({ values: 'falsy' })
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Invalid email address'),
];

// Login validation
exports.loginRules = [
  phone(),

  check('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Change password validation
exports.changePasswordRules = [
  check('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  password('newPassword')
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage('New password must be different from the current one'),
];

// Forgot password validation
exports.forgotPasswordRules = [
  email(),
];

// Verify reset code validation
exports.verifyResetCodeRules = [
  email(),

  check('resetCode')
    .notEmpty()
    .withMessage('Reset code is required')
    .bail()
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Reset code must be 6 digits'),
];

// Reset password validation
exports.resetPasswordRules = [
  email(),
  password('newPassword'),
];

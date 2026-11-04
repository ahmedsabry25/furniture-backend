const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');

const AppError = require('../utils/AppError');
const sanitizeUser = require('../utils/sanitizeUser');
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');

// Used when the phone is not found, so response time looks the same
// as for a wrong password (prevents user enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

const MAX_RESET_ATTEMPTS = 5;
const RESET_CODE_TTL_MS = 10 * 60 * 1000;

const createToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const clearResetFields = (user) => {
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  user.passwordResetVerified = undefined;
  user.passwordResetAttempts = 0;
};

// POST /api/auth/signup
exports.signup = asyncHandler(async (req, res, next) => {
  // role is never read from the body, so nobody can register as admin
  const { name, phone, email, password } = req.body;

  const user = await User.create({
    name,
    phone,
    ...(email && { email }),
    passwordHash: await User.hashPassword(password),
  });

  const token = createToken(user._id);
  res.status(201).json({ success: true, data: sanitizeUser(user), token });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res, next) => {
  if (!req.body.phone || !req.body.password) {
    return next(new AppError('Phone and password are required', 400));
  }

  // String() so an object like {"$gt": ""} can never reach the query
  const user = await User.findOne({ phone: String(req.body.phone) }).select('+passwordHash');

  const passwordOk = await bcrypt.compare(
    String(req.body.password),
    user ? user.passwordHash : DUMMY_HASH
  );

  // Same message for unknown phone and wrong password
  if (!user || !passwordOk) {
    return next(new AppError('Incorrect phone or password', 401));
  }
  if (!user.isActive) {
    return next(new AppError('This account is deactivated', 403));
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = createToken(user._id);
  res.status(200).json({ success: true, data: sanitizeUser(user), token });
});

const getTokenFromHeader = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.split(' ')[1] : null;
};

// Returns the user of a token. Throws if the token or the account is not valid
const getUserFromToken = async (token) => {
  // invalid or expired token throws, and error.js returns 401
  const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

  const currentUser = await User.findById(decoded.userId);
  if (!currentUser) throw new AppError('The user of this token no longer exists', 401);
  if (!currentUser.isActive) throw new AppError('This account is deactivated', 403);

  // reject tokens issued before the last password change
  if (currentUser.passwordChangedAt) {
    const changedAt = parseInt(currentUser.passwordChangedAt.getTime() / 1000, 10);
    if (changedAt > decoded.iat) {
      throw new AppError('Password was changed recently, please login again', 401);
    }
  }
  return currentUser;
};

// Requires a valid token and loads the user into req.user
exports.protect = asyncHandler(async (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) return next(new AppError('You are not logged in, please login first', 401));

  req.user = await getUserFromToken(token);
  next();
});

// For routes that work for visitors AND logged-in users (the cart).
// No token = visitor. A token that is present but invalid is still rejected
exports.optionalAuth = asyncHandler(async (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (token) req.user = await getUserFromToken(token);
  next();
});

// Allows only the given roles: allowedTo('admin', 'super_admin')
exports.allowedTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You are not allowed to access this route', 403));
  }
  next();
};

// GET /api/auth/me
exports.getMe = (req, res) => {
  res.status(200).json({ success: true, data: sanitizeUser(req.user) });
};

// PATCH /api/auth/change-password
exports.changeMyPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+passwordHash');

  const currentOk = await bcrypt.compare(String(req.body.currentPassword), user.passwordHash);
  if (!currentOk) {
    return next(new AppError('Current password is incorrect', 401));
  }

  user.passwordHash = await User.hashPassword(req.body.newPassword);
  // minus 1 second so the new token (same second) is not rejected
  user.passwordChangedAt = new Date(Date.now() - 1000);
  await user.save();

  // old tokens are now invalid, so return a fresh one
  const token = createToken(user._id);
  res.status(200).json({ success: true, message: 'Password updated', token });
});

// ---------- Forgot password flow (email + 6 digit code) ----------

// POST /api/auth/forgot-password
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const genericReply = {
    success: true,
    message: 'If this email is registered, a reset code has been sent',
  };

  // 1- get user by email
  const user = await User.findOne({ email: String(req.body.email).toLowerCase() });

  // Same reply whether the email exists or not (no user enumeration)
  if (!user || !user.isActive) {
    return res.status(200).json(genericReply);
  }

  // 2- generate a 6 digit code, store only its hash
  const resetCode = crypto.randomInt(100000, 1000000).toString();
  user.passwordResetCode = hashCode(resetCode);
  user.passwordResetExpires = Date.now() + RESET_CODE_TTL_MS;
  user.passwordResetVerified = false;
  user.passwordResetAttempts = 0;
  await user.save();

  // 3- send the code by email
  const message =
    `Hi ${user.name},\n` +
    `We received a request to reset the password of your account.\n\n` +
    `${resetCode}\n\n` +
    `Enter this code to continue. It is valid for 10 minutes.\n` +
    `If you did not request this, you can ignore this email.`;

  try {
    await sendEmail({ email: user.email, subject: 'Your password reset code (valid for 10 min)', message });
  } catch (err) {
    clearResetFields(user);
    await user.save();
    return next(new AppError('Could not send the email, please try again later', 500));
  }

  res.status(200).json(genericReply);
});

// POST /api/auth/verify-reset-code
exports.verifyResetCode = asyncHandler(async (req, res, next) => {
  const invalid = new AppError('Reset code is invalid or expired', 400);

  // 1- find the user by email, with a code that is still valid
  const user = await User.findOne({
    email: String(req.body.email).toLowerCase(),
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetCode');

  if (!user || !user.passwordResetCode) return next(invalid);

  // 2- stop brute force: a few wrong attempts kill the code
  if ((user.passwordResetAttempts || 0) >= MAX_RESET_ATTEMPTS) {
    clearResetFields(user);
    await user.save();
    return next(new AppError('Too many wrong attempts, request a new code', 429));
  }

  // 3- compare hashes in constant time
  const sent = Buffer.from(hashCode(req.body.resetCode));
  const stored = Buffer.from(user.passwordResetCode);
  if (sent.length !== stored.length || !crypto.timingSafeEqual(sent, stored)) {
    user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
    await user.save();
    return next(invalid);
  }

  // 4- code is valid
  user.passwordResetVerified = true;
  await user.save();
  res.status(200).json({ success: true, message: 'Reset code verified' });
});

// POST /api/auth/reset-password
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // The code must have been verified for this email and still be inside its 10 minutes
  const user = await User.findOne({
    email: String(req.body.email).toLowerCase(),
    passwordResetVerified: true,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError('Reset code was not verified or has expired', 400));
  }

  user.passwordHash = await User.hashPassword(req.body.newPassword);
  user.passwordChangedAt = new Date(Date.now() - 1000); // kills all old tokens
  clearResetFields(user);
  await user.save();

  const token = createToken(user._id);
  res.status(200).json({ success: true, message: 'Password reset successfully', token });
});
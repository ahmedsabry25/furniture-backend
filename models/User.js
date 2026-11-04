const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');
const { normalizePhone, EGYPT_MOBILE_REGEX } = require('../utils/phone');

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name is too short'],
      maxlength: [80, 'Name is too long'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      unique: true,
      set: normalizePhone,
      match: [EGYPT_MOBILE_REGEX, 'Invalid phone number'],
    },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    isActive: { type: Boolean, default: true },
    passwordChangedAt: Date,
    lastLoginAt: Date,
    passwordResetCode: { type: String, select: false },
    passwordResetExpires: Date,
    passwordResetVerified: Boolean,
    passwordResetAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 12);

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = model('User', userSchema);
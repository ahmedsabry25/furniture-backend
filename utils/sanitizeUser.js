// Removes sensitive fields before sending a user to the client
module.exports = (user) => {
  const data = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete data.passwordHash;
  delete data.passwordChangedAt;
  delete data.passwordResetCode;
  delete data.passwordResetExpires;
  delete data.passwordResetVerified;
  delete data.passwordResetAttempts;
  delete data.__v;
  return data;
};
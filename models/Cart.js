const { Schema, model } = require('mongoose');

const MAX_LINES = 50;

const cartItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      max: [100, 'Quantity is too large'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
  },
  { _id: false }
);

const cartSchema = new Schema(
  {
    // A cart belongs to a user OR to a visitor
    user: { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    // Only the hash of the visitor token is stored, so a database leak does not leak carts
    guestTokenHash: { type: String, unique: true, sparse: true },

    items: {
      type: [cartItemSchema],
      validate: [(items) => items.length <= MAX_LINES, `A cart can have up to ${MAX_LINES} products`],
    },

    // Visitor carts only: MongoDB deletes the cart by itself after this date
    expiresAt: Date,
  },
  { timestamps: true }
);

cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

cartSchema.pre('validate', function () {
  if (!this.user && !this.guestTokenHash) this.invalidate('user', 'A cart needs an owner');
});

module.exports = model('Cart', cartSchema);
module.exports.MAX_LINES = MAX_LINES;
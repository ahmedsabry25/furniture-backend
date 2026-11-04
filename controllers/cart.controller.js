const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const Cart = require('../models/Cart');
const AppError = require('../utils/AppError');
const { findVisibleProduct, buildCartView } = require('../services/cart.service');

const { MAX_LINES } = Cart;
const GUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000; // visitor carts live 30 days after the last use
const TOKEN_REGEX = /^[a-f0-9]{64}$/;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// The visitor token comes in the "x-cart-token" header. Anything that is not a valid token is ignored
const readGuestToken = (req) => {
  const token = req.headers['x-cart-token'];
  return typeof token === 'string' && TOKEN_REGEX.test(token) ? token : null;
};

// The cart of the current user (logged in) or visitor (token). null if there is none yet
const findCart = async (req) => {
  if (req.user) return Cart.findOne({ user: req.user._id });
  const token = readGuestToken(req);
  return token ? Cart.findOne({ guestTokenHash: hashToken(token) }) : null;
};

// Same as findCart, but creates the cart when it does not exist.
// For a new visitor cart, it also returns the token the frontend must keep
const getOrCreateCart = async (req) => {
  const existing = await findCart(req);
  if (existing) return { cart: existing };

  if (req.user) {
    try {
      return { cart: await Cart.create({ user: req.user._id }) };
    } catch (err) {
      // two first requests at the same moment: the second one just reads it
      if (err.code === 11000) return { cart: await Cart.findOne({ user: req.user._id }) };
      throw err;
    }
  }

  const cartToken = crypto.randomBytes(32).toString('hex');
  const cart = await Cart.create({
    guestTokenHash: hashToken(cartToken),
    expiresAt: new Date(Date.now() + GUEST_TTL_MS),
  });
  return { cart, cartToken };
};

// Visitor carts live 30 days from the last change
const touch = (req, cart) =>
  req.user ? null : Cart.updateOne({ _id: cart._id }, { $set: { expiresAt: new Date(Date.now() + GUEST_TTL_MS) } });

// Reads the cart again and sends it
const send = async (res, cartId, cartToken) => {
  const cart = cartId ? await Cart.findById(cartId) : null;
  const data = await buildCartView(cart);
  res.json({ success: true, data, ...(cartToken && { cartToken }) });
};

// GET /api/cart (visitor or user)
exports.get = asyncHandler(async (req, res) => {
  const cart = await findCart(req);
  await send(res, cart && cart._id);
});

// POST /api/cart/items (visitor or user)
// Body: { "productId": "...", "quantity": 2 }  (quantity is added to what is already in the cart)
exports.addItem = asyncHandler(async (req, res) => {
  const quantity = req.body.quantity || 1;

  const product = await findVisibleProduct(req.body.productId);
  if (!product) throw new AppError('Product not found', 404);
  if (product.stock <= 0) throw new AppError('This product is out of stock', 400);

  const maxAllowed = Math.min(product.stock, product.maxQtyPerOrder);
  if (quantity > maxAllowed) throw new AppError(`Only ${maxAllowed} can be ordered of this product`, 400);

  const { cart, cartToken } = await getOrCreateCart(req);

  // 1) The product is already in the cart and the new total fits: increase its quantity
  const increased = await Cart.updateOne(
    { _id: cart._id, items: { $elemMatch: { product: product._id, quantity: { $lte: maxAllowed - quantity } } } },
    { $inc: { 'items.$.quantity': quantity } }
  );

  if (!increased.matchedCount) {
    // 2) Not in the cart yet: add one line (never two lines for the same product)
    const added = await Cart.updateOne(
      { _id: cart._id, 'items.product': { $ne: product._id }, [`items.${MAX_LINES - 1}`]: { $exists: false } },
      { $push: { items: { product: product._id, quantity } } }
    );

    if (!added.matchedCount) {
      const alreadyThere = await Cart.exists({ _id: cart._id, 'items.product': product._id });
      throw new AppError(
        alreadyThere
          ? `You can order up to ${maxAllowed} of this product, and your cart already has most of it`
          : `The cart is full (up to ${MAX_LINES} products)`,
        400
      );
    }
  }

  await touch(req, cart);
  await send(res, cart._id, cartToken);
});

// PATCH /api/cart/items/:productId (visitor or user)
// Body: { "quantity": 3 } sets the quantity
exports.updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;

  const cart = await findCart(req);
  if (!cart) throw new AppError('This product is not in your cart', 404);

  const product = await findVisibleProduct(req.params.productId);
  if (!product) throw new AppError('This product is no longer available, remove it from your cart', 404);
  if (product.stock <= 0) throw new AppError('This product is out of stock, remove it from your cart', 400);

  const maxAllowed = Math.min(product.stock, product.maxQtyPerOrder);
  if (quantity > maxAllowed) throw new AppError(`Only ${maxAllowed} can be ordered of this product`, 400);

  const updated = await Cart.updateOne(
    { _id: cart._id, 'items.product': product._id },
    { $set: { 'items.$.quantity': quantity } }
  );
  if (!updated.matchedCount) throw new AppError('This product is not in your cart', 404);

  await touch(req, cart);
  await send(res, cart._id);
});

// DELETE /api/cart/items/:productId (visitor or user)
exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await findCart(req);
  if (cart) {
    await Cart.updateOne({ _id: cart._id }, { $pull: { items: { product: req.params.productId } } });
    await touch(req, cart);
  }
  await send(res, cart && cart._id);
});

// DELETE /api/cart (visitor or user): empties the cart
exports.clear = asyncHandler(async (req, res) => {
  const cart = await findCart(req);
  if (cart) await Cart.updateOne({ _id: cart._id }, { $set: { items: [] } });
  await send(res, cart && cart._id);
});

// POST /api/cart/merge (logged in only)
// Call it right after login / signup with the old "x-cart-token" header:
// the visitor cart is added to the user cart, then deleted
exports.merge = asyncHandler(async (req, res) => {
  const { cart } = await getOrCreateCart(req);

  const token = readGuestToken(req);
  const guestCart = token ? await Cart.findOne({ guestTokenHash: hashToken(token) }) : null;

  if (guestCart && guestCart.items.length) {
    const merged = new Map(cart.items.map((line) => [String(line.product), line.quantity]));

    for (const line of guestCart.items) {
      const product = await findVisibleProduct(line.product);
      if (!product || product.stock <= 0) continue; // skip what cannot be bought now

      const maxAllowed = Math.min(product.stock, product.maxQtyPerOrder);
      const key = String(product._id);
      merged.set(key, Math.min((merged.get(key) || 0) + line.quantity, maxAllowed));
    }

    const items = [...merged].slice(0, MAX_LINES).map(([product, quantity]) => ({ product, quantity }));
    await Cart.updateOne({ _id: cart._id }, { $set: { items } });
  }

  if (guestCart) await guestCart.deleteOne(); // calling it twice is safe: the second time there is nothing to merge
  await send(res, cart._id);
});
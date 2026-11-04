const Product = require('../models/Product');

// Finds a product the visitors can see: active, not deleted, and its category is active.
// Returns null when the product cannot be bought. (Stock is checked by the caller)
exports.findVisibleProduct = async (id) => {
  const product = await Product.findOne({ _id: id, status: 'active', deletedAt: null }).populate({
    path: 'category',
    select: 'isActive',
  });
  return product && product.category && product.category.isActive ? product : null;
};

const emptyView = { items: [], itemsCount: 0, subtotal: 0, canCheckout: false };

// Turns a cart into what the frontend shows. Prices and stock are read from the products NOW
// Nothing is changed in the database here: problems are only flagged
exports.buildCartView = async (cart) => {
  if (!cart) return emptyView;

  await cart.populate({ path: 'items.product', populate: { path: 'category', select: 'isActive' } });

  const items = cart.items
    .filter((line) => line.product) // product removed from the database: ignore the line
    .map((line) => {
      const product = line.product;
      const visible = product.status === 'active' && !product.deletedAt && product.category && product.category.isActive;
      const maxAllowed = visible ? Math.min(product.stock, product.maxQtyPerOrder) : 0;

      let issue = null;
      if (!visible) issue = 'unavailable';
      else if (product.stock <= 0) issue = 'out_of_stock';
      else if (line.quantity > maxAllowed) issue = 'quantity_exceeds_limit';

      const unitPrice = product.getEffectivePrice();

      return {
        productId: product._id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        image: product.images.length ? product.images[0].url : null,
        quantity: line.quantity,
        originalPrice: product.price,
        unitPrice, // what the customer pays for one piece (discount applied)
        lineTotal: issue ? 0 : unitPrice * line.quantity,
        stock: product.stock,
        maxAllowed, // the biggest quantity the customer can ask for now
        available: !issue,
        issue, // null | 'unavailable' | 'out_of_stock' | 'quantity_exceeds_limit'
      };
    });

  const available = items.filter((item) => item.available);

  return {
    items,
    itemsCount: available.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: available.reduce((sum, item) => sum + item.lineTotal, 0), // piasters
    canCheckout: items.length > 0 && items.every((item) => item.available),
  };
};
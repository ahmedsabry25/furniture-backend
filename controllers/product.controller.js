const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const Category = require('../models/ProductCategory');
const Sector = require('../models/EstablishmentSector');
const AppError = require('../utils/AppError');
const pick = require('../utils/pick');
const slugify = require('../utils/slugify');
const { getPagination, meta, escapeRegex } = require('../utils/pagination');
const { uploadImages, removeFile } = require('../services/storage');

const MAX_IMAGES = 10;

// Only these fields can be set from the request body
const FIELDS = [
  'name', 'slug', 'sku', 'description', 'category', 'sectors',
  'price', 'discountPrice', 'discountStartsAt', 'discountEndsAt',
  'stock', 'status', 'maxQtyPerOrder', 'specifications', 'dimensions',
  'materials', 'finishes', 'components', 'isFeatured',
];

const SORTS = { newest: '-createdAt', price_asc: 'price', price_desc: '-price', name: 'name.ar' };

// Admin sees everything. Visitors only see active categories and sectors
const ADMIN_POPULATE = [
  { path: 'category', select: 'name slug isActive' },
  { path: 'sectors', select: 'name slug isActive' },
];
const PUBLIC_POPULATE = [
  { path: 'category', select: 'name slug' },
  { path: 'sectors', select: 'name slug', match: { isActive: true } },
];

const findProduct = async (id) => {
  const product = await Product.findOne({ _id: id, deletedAt: null });
  if (!product) throw new AppError('Product not found', 404);
  return product;
};

// Makes sure the category and the sectors really exist
const checkRefs = async (body) => {
  if (body.category !== undefined && !(await Category.exists({ _id: body.category }))) {
    throw new AppError('Category not found', 400);
  }
  if (body.sectors !== undefined) {
    body.sectors = [...new Set(body.sectors.map(String))]; // no duplicates
    const found = await Sector.countDocuments({ _id: { $in: body.sectors } });
    if (found !== body.sectors.length) throw new AppError('One or more sectors not found', 400);
  }
};

// Builds the search / filter conditions. Same function for visitors and admin
const buildFilter = async (q, { admin }) => {
  const filter = { deletedAt: null };

  if (admin) {
    if (q.status) filter.status = String(q.status);
    if (q.category) filter.category = String(q.category);
    if (q.sector) filter.sectors = String(q.sector);
    if (q.lowStock !== undefined) filter.stock = { $lte: Number(q.lowStock) };
  } else {
    filter.status = 'active';

    // Products of inactive categories are hidden. ?category=<slug> narrows it to one
    const categoryIds = await Category.find({
      isActive: true,
      ...(q.category && { slug: String(q.category).toLowerCase() }),
    }).distinct('_id');
    filter.category = { $in: categoryIds };

    if (q.sector) {
      const sectorIds = await Sector.find({ isActive: true, slug: String(q.sector).toLowerCase() }).distinct('_id');
      filter.sectors = { $in: sectorIds };
    }
    if (q.inStock === 'true') filter.stock = { $gt: 0 };
    if (q.featured === 'true') filter.isFeatured = true;
        // On sale = has a discount that is valid right now (inside its dates)
    if (q.onSale === 'true') {
      const now = new Date();
      filter.$and = [
        { discountPrice: { $ne: null } },
        { $expr: { $lt: ['$discountPrice', '$price'] } },
        { $or: [{ discountStartsAt: null }, { discountStartsAt: { $lte: now } }] },
        { $or: [{ discountEndsAt: null }, { discountEndsAt: { $gte: now } }] },
      ];
    }
  }

  if (q.q) {
    const regex = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ 'name.ar': regex }, { 'name.en': regex }, ...(admin ? [{ sku: regex }] : [])];
  }

  // Note: price filters use the original price, not the discounted one
  if (q.minPrice || q.maxPrice) {
    filter.price = {};
    if (q.minPrice) filter.price.$gte = Number(q.minPrice);
    if (q.maxPrice) filter.price.$lte = Number(q.maxPrice);
  }

  return filter;
};

const listHandler = (admin) =>
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const filter = await buildFilter(req.query, { admin });
    const sort = `${SORTS[req.query.sort] || SORTS.newest} _id`;

    const [items, total] = await Promise.all([
      Product.find(filter)
        .select(admin ? '' : '-deletedAt -salesCount')
        .populate(admin ? ADMIN_POPULATE : PUBLIC_POPULATE)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    res.json({ success: true,count: items.length, data: items, meta: meta(page, limit, total) });
  });

// GET /api/products (public)
// Query: page, limit, q, category (slug), sector (slug), minPrice, maxPrice, inStock, featured, sort
exports.listPublic = listHandler(false);

// GET /api/products/admin (admin): includes inactive products and the sku search
// Query: same as above + status, lowStock. category and sector take ids here
exports.listAdmin = listHandler(true);

// GET /api/products/:slug (public)
exports.getBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    slug: req.params.slug.toLowerCase(),
    status: 'active',
    deletedAt: null,
  })
    .select('-deletedAt -salesCount')
    .populate([
      { path: 'category', select: 'name slug isActive' },
      { path: 'sectors', select: 'name slug', match: { isActive: true } },
    ]);

  // A product of an inactive category is hidden too
  if (!product || !product.category || !product.category.isActive) {
    throw new AppError('Product not found', 404);
  }
  res.json({ success: true, data: product });
});

// GET /api/products/admin/:id (admin)
exports.getOne = asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.id);
  await product.populate(ADMIN_POPULATE);
  res.json({ success: true, data: product });
});

// POST /api/products (admin)
exports.create = asyncHandler(async (req, res) => {
  const body = pick(req.body, FIELDS);
  await checkRefs(body);
  if (!body.slug) body.slug = slugify(`${body.name.ar} ${body.sku}`);

  const product = await Product.create(body);
  res.status(201).json({ success: true, data: product });
});

// PATCH /api/products/:id (admin)
// Note: arrays (sectors, materials, ...) and objects (name, description) are replaced as a whole
exports.update = asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.id);
  const body = pick(req.body, FIELDS);
  await checkRefs(body);

  product.set(body); // slug is kept as it is when the name changes (stable links)
  await product.save();
  res.json({ success: true, data: product });
});

// DELETE /api/products/:id (admin): soft delete, old orders keep pointing to it
exports.remove = asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.id);
  product.deletedAt = new Date();
  product.status = 'inactive';
  await product.save();
  res.json({ success: true, message: 'Product deleted' });
});

// PATCH /api/products/:id/stock (admin)
// Body: { "stock": 20 } sets the number | { "change": -3 } adds or subtracts
exports.updateStock = asyncHandler(async (req, res) => {
  const { stock, change } = req.body;
  await findProduct(req.params.id); // 404 if missing or deleted

  let product;
  if (stock !== undefined) {
    product = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true });
  } else {
    // One atomic update: the condition stops stock from going below zero even with parallel requests
    product = await Product.findOneAndUpdate(
      { _id: req.params.id, stock: { $gte: -change } },
      { $inc: { stock: change } },
      { new: true }
    );
    if (!product) throw new AppError('Current stock is not enough for this change', 400);
  }

  res.json({ success: true, data: { _id: product._id, sku: product.sku, stock: product.stock } });
});

// POST /api/products/:id/images (admin): up to 10 images in the "images" field
exports.addImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw new AppError('Please upload at least one image in the "images" field', 400);

  // Check the product and the limit BEFORE uploading anything
  const product = await findProduct(req.params.id);
  if (product.images.length + files.length > MAX_IMAGES) {
    throw new AppError(`A product can have up to ${MAX_IMAGES} images (it has ${product.images.length})`, 400);
  }

  const uploaded = await uploadImages(files, 'products');
  product.images.push(...uploaded);

  try {
    await product.save();
  } catch (err) {
    await Promise.all(uploaded.map((image) => removeFile(image.key))); // do not leave orphan images
    throw err;
  }

  res.status(201).json({ success: true, data: product.images });
});

// DELETE /api/products/:id/images/:imageId (admin)
exports.removeImage = asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.id);
  const image = product.images.id(req.params.imageId);
  if (!image) throw new AppError('Image not found', 404);

  const key = image.key;
  product.images.pull(image._id);
  await product.save();
  await removeFile(key);

  res.json({ success: true, data: product.images });
});

// PATCH /api/products/:id/images/:imageId/main (admin): moves the image to the first place
exports.setMainImage = asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.id);
  const index = product.images.findIndex((image) => String(image._id) === req.params.imageId);
  if (index === -1) throw new AppError('Image not found', 404);

  const [image] = product.images.splice(index, 1);
  product.images.unshift(image);
  await product.save();

  res.json({ success: true, data: product.images });
});

// Used by the home page: same visibility rules as the public list, newest first
exports.findPublic = async (query, limit) => {
  const filter = await buildFilter(query, { admin: false });
  return Product.find(filter)
    .select('-deletedAt -salesCount')
    .populate(PUBLIC_POPULATE)
    .sort(`${SORTS.newest} _id`)
    .limit(limit);
};
const asyncHandler = require('express-async-handler');
const Category = require('../models/ProductCategory');
const AppError = require('../utils/AppError');
const pick = require('../utils/pick');
const slugify = require('../utils/slugify');
const { uploadImage, removeFile } = require('../services/storage');
const Product = require('../models/Product');

// Only these fields can be set from the request body
const FIELDS = ['name', 'slug', 'description', 'sortOrder', 'isActive', 'showInNavbar'];

const findCategory = async (id) => {
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found', 404);
  return category;
};

// GET /api/categories (public): active categories only
// Optional: ?navbar=true returns only the ones shown in the navbar
exports.listPublic = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.navbar === 'true') filter.showInNavbar = true;

  const categories = await Category.find(filter).sort('sortOrder createdAt');
  res.json({ success: true,count: categories.length, data: categories });
});

// GET /api/categories/admin (admin): all categories
exports.listAdmin = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort('sortOrder createdAt');
  res.json({ success: true, data: categories });
});

// GET /api/categories/:id (admin)
exports.getOne = asyncHandler(async (req, res) => {
  res.json({ success: true,count: categories.length, data: await findCategory(req.params.id) });
});

// POST /api/categories (admin)
exports.create = asyncHandler(async (req, res) => {
  const body = pick(req.body, FIELDS);
  if (!body.slug) body.slug = slugify(body.name.ar);
  if (!body.slug) throw new AppError('Could not generate a slug, please provide one', 400);

  const category = await Category.create(body);
  res.status(201).json({ success: true, data: category });
});

// PATCH /api/categories/:id (admin)
exports.update = asyncHandler(async (req, res) => {
  const category = await findCategory(req.params.id);
  category.set(pick(req.body, FIELDS));
  await category.save();
  res.json({ success: true, data: category });
});

// DELETE /api/categories/:id (admin)
// TODO (products step): refuse deletion when products use this category
// DELETE /api/categories/:id (admin)
exports.remove = asyncHandler(async (req, res) => {
  const category = await findCategory(req.params.id);

  // Deleted products still count: old orders point to them
  if (await Product.exists({ category: category._id })) {
    throw new AppError('This category has products. Deactivate it instead of deleting it', 409);
  }

  await category.deleteOne();
  if (category.image && category.image.key) await removeFile(category.image.key);
  res.json({ success: true, message: 'Category deleted' });
});

// PATCH /api/categories/reorder (admin)
// Body: { "items": [{ "id": "...", "sortOrder": 1 }, ...] }
exports.reorder = asyncHandler(async (req, res) => {
  const operations = req.body.items.map((item) => ({
    updateOne: { filter: { _id: item.id }, update: { sortOrder: item.sortOrder } },
  }));
  await Category.bulkWrite(operations);
  res.json({ success: true, message: 'Order updated' });
});

// POST /api/categories/:id/image (admin): upload or replace the image
exports.setImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please upload an image in the "image" field', 400);

  // Check the category exists BEFORE uploading anything
  const category = await findCategory(req.params.id);

  const uploaded = await uploadImage(req.file, 'categories');
  const oldKey = category.image && category.image.key;
  category.image = uploaded;

  try {
    await category.save();
  } catch (err) {
    await removeFile(uploaded.key); // saving failed, do not leave an orphan image
    throw err;
  } 

  if (oldKey) await removeFile(oldKey); // delete the old image after the new one is saved
  res.json({ success: true, data: category });
});

// DELETE /api/categories/:id/image (admin)
exports.removeImage = asyncHandler(async (req, res) => {
  const category = await findCategory(req.params.id);
  if (!category.image || !category.image.key) throw new AppError('Category has no image', 404);

  const oldKey = category.image.key;
  category.image = undefined;
  await category.save();
  await removeFile(oldKey);

  res.json({ success: true, data: category });
});
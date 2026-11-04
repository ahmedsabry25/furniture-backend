const asyncHandler = require('express-async-handler');
const Sector = require('../models/EstablishmentSector');
const AppError = require('../utils/AppError');
const pick = require('../utils/pick');
const slugify = require('../utils/slugify');
const { uploadImage, removeFile } = require('../services/storage');
const Product = require('../models/Product');

// Only these fields can be set from the request body
const FIELDS = ['name', 'slug', 'description', 'sortOrder', 'isActive', 'formFields'];

const findSector = async (id) => {
  const sector = await Sector.findById(id);
  if (!sector) throw new AppError('Sector not found', 404);
  return sector;
};

// GET /api/sectors (public): active sectors for the home page (without form fields)
exports.listPublic = asyncHandler(async (req, res) => {
  const sectors = await Sector.find({ isActive: true }).select('-formFields').sort('sortOrder createdAt');
  res.json({ success: true, data: sectors });
});

// GET /api/sectors/:slug (public): one active sector WITH its form fields (to draw the form)
exports.getBySlug = asyncHandler(async (req, res) => {
  const sector = await Sector.findOne({ slug: req.params.slug.toLowerCase(), isActive: true });
  if (!sector) throw new AppError('Sector not found', 404);

  const data = sector.toObject();
  data.formFields = [...data.formFields].sort((a, b) => a.sortOrder - b.sortOrder);
  res.json({ success: true, data });
});

// GET /api/sectors/admin (admin): all sectors, without form fields (lighter list)
exports.listAdmin = asyncHandler(async (req, res) => {
  const sectors = await Sector.find().select('-formFields').sort('sortOrder createdAt');
  res.json({ success: true, data: sectors });
});

// GET /api/sectors/admin/:id (admin): one sector with everything
exports.getOne = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await findSector(req.params.id) });
});

// POST /api/sectors (admin)
exports.create = asyncHandler(async (req, res) => {
  const body = pick(req.body, FIELDS);
  if (!body.slug) body.slug = slugify(body.name.ar);
  if (!body.slug) throw new AppError('Could not generate a slug, please provide one', 400);

  const sector = await Sector.create(body);
  res.status(201).json({ success: true, data: sector });
});

// PATCH /api/sectors/:id (admin)
// Note: sending formFields replaces the whole list (send the complete list)
exports.update = asyncHandler(async (req, res) => {
  const sector = await findSector(req.params.id);
  sector.set(pick(req.body, FIELDS));
  await sector.save();
  res.json({ success: true, data: sector });
});

// DELETE /api/sectors/:id (admin)
// TODO (products step): refuse deletion when products use this sector
// DELETE /api/sectors/:id (admin)
exports.remove = asyncHandler(async (req, res) => {
  const sector = await findSector(req.params.id);

  if (await Product.exists({ sectors: sector._id })) {
    throw new AppError('This sector has products. Deactivate it instead of deleting it', 409);
  }

  await sector.deleteOne();
  if (sector.image && sector.image.key) await removeFile(sector.image.key);
  res.json({ success: true, message: 'Sector deleted' });
});

// PATCH /api/sectors/reorder (admin)
// Body: { "items": [{ "id": "...", "sortOrder": 1 }, ...] }
exports.reorder = asyncHandler(async (req, res) => {
  const operations = req.body.items.map((item) => ({
    updateOne: { filter: { _id: item.id }, update: { sortOrder: item.sortOrder } },
  }));
  await Sector.bulkWrite(operations);
  res.json({ success: true, message: 'Order updated' });
});

// POST /api/sectors/:id/image (admin): upload or replace the image
exports.setImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please upload an image in the "image" field', 400);

  // Check the sector exists BEFORE uploading anything
  const sector = await findSector(req.params.id);

  const uploaded = await uploadImage(req.file, 'sectors');
  const oldKey = sector.image && sector.image.key;
  sector.image = uploaded;

  try {
    await sector.save();
  } catch (err) {
    await removeFile(uploaded.key); // saving failed, do not leave an orphan image
    throw err;
  }

  if (oldKey) await removeFile(oldKey); // delete the old image after the new one is saved
  res.json({ success: true, data: sector });
});

// DELETE /api/sectors/:id/image (admin)
exports.removeImage = asyncHandler(async (req, res) => {
  const sector = await findSector(req.params.id);
  if (!sector.image || !sector.image.key) throw new AppError('Sector has no image', 404);

  const oldKey = sector.image.key;
  sector.image = undefined;
  await sector.save();
  await removeFile(oldKey);

  res.json({ success: true, data: sector });
});
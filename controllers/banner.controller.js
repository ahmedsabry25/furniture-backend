const asyncHandler = require('express-async-handler');
const Banner = require('../models/HomepageBanner');
const AppError = require('../utils/AppError');
const pick = require('../utils/pick');
const { uploadImage, removeFile } = require('../services/storage');

const FIELDS = [
  'title', 'subtitle', 'buttonText', 'linkType', 'linkValue',
  'sortOrder', 'isActive', 'startsAt', 'endsAt',
];

const findBanner = async (id) => {
  const banner = await Banner.findById(id);
  if (!banner) throw new AppError('Banner not found', 404);
  return banner;
};

// GET /api/banners (admin): all banners, each one has "isLive"
exports.list = asyncHandler(async (req, res) => {
  const banners = await Banner.find().sort('sortOrder createdAt');
  res.json({ success: true, data: banners });
});

// GET /api/banners/:id (admin)
exports.getOne = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await findBanner(req.params.id) });
});

// POST /api/banners (admin): create it, then upload its image
exports.create = asyncHandler(async (req, res) => {
  const banner = await Banner.create(pick(req.body, FIELDS));
  res.status(201).json({ success: true, data: banner });
});

// PATCH /api/banners/:id (admin)
exports.update = asyncHandler(async (req, res) => {
  const banner = await findBanner(req.params.id);
  banner.set(pick(req.body, FIELDS));
  await banner.save();
  res.json({ success: true, data: banner });
});

// DELETE /api/banners/:id (admin)
exports.remove = asyncHandler(async (req, res) => {
  const banner = await findBanner(req.params.id);
  await banner.deleteOne();
  if (banner.image && banner.image.key) await removeFile(banner.image.key);
  res.json({ success: true, message: 'Banner deleted' });
});

// PATCH /api/banners/reorder (admin)
// Body: { "items": [{ "id": "...", "sortOrder": 1 }, ...] }
exports.reorder = asyncHandler(async (req, res) => {
  const operations = req.body.items.map((item) => ({
    updateOne: { filter: { _id: item.id }, update: { sortOrder: item.sortOrder } },
  }));
  await Banner.bulkWrite(operations);
  res.json({ success: true, message: 'Order updated' });
});

// POST /api/banners/:id/image (admin): upload or replace the image (field name: image)
exports.setImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please upload an image in the "image" field', 400);

  const banner = await findBanner(req.params.id); // check BEFORE uploading
  const uploaded = await uploadImage(req.file, 'banners');
  const oldKey = banner.image && banner.image.key;
  banner.image = uploaded;

  try {
    await banner.save();
  } catch (err) {
    await removeFile(uploaded.key); // do not leave an orphan image
    throw err;
  }

  if (oldKey) await removeFile(oldKey);
  res.json({ success: true, data: banner });
});
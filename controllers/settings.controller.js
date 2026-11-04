const asyncHandler = require('express-async-handler');
const Settings = require('../models/SiteSettings');
const AppError = require('../utils/AppError');
const pick = require('../utils/pick');
const { uploadImage, removeFile } = require('../services/storage');

const FIELDS = [
  'companyName', 'topBarText', 'about', 'address', 'workingHours',
  'phone', 'whatsapp', 'email', 'social', 'shippingFee',
];

// GET /api/settings (public)
exports.get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Settings.getMain() });
});

// PATCH /api/settings (admin)
// Note: "social" is replaced as a whole (send all the links you want to keep)
exports.update = asyncHandler(async (req, res) => {
  const settings = await Settings.getMain();
  settings.set(pick(req.body, FIELDS));
  await settings.save();
  res.json({ success: true, data: settings });
});

// POST /api/settings/logo (admin): upload or replace the logo (field name: image)
exports.setLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please upload an image in the "image" field', 400);

  const settings = await Settings.getMain();
  const uploaded = await uploadImage(req.file, 'settings');
  const oldKey = settings.logo && settings.logo.key;
  settings.logo = uploaded;

  try {
    await settings.save();
  } catch (err) {
    await removeFile(uploaded.key); // do not leave an orphan image
    throw err;
  }

  if (oldKey) await removeFile(oldKey);
  res.json({ success: true, data: settings });
});

// DELETE /api/settings/logo (admin)
exports.removeLogo = asyncHandler(async (req, res) => {
  const settings = await Settings.getMain();
  if (!settings.logo || !settings.logo.key) throw new AppError('There is no logo', 404);

  const oldKey = settings.logo.key;
  settings.logo = undefined;
  await settings.save();
  await removeFile(oldKey);

  res.json({ success: true, data: settings });
});
const asyncHandler = require('express-async-handler');
const Settings = require('../models/SiteSettings');
const Banner = require('../models/HomepageBanner');
const Category = require('../models/ProductCategory');
const Sector = require('../models/EstablishmentSector');
const { findPublic } = require('./product.controller');

const HOME_PRODUCTS_LIMIT = 8;

// GET /api/home (public): everything the home page needs in ONE request
exports.getHome = asyncHandler(async (req, res) => {
  const [settings, banners, categories, sectors, featured, offers] = await Promise.all([
    Settings.getMain(),
    Banner.findLive(),
    Category.find({ isActive: true }).sort('sortOrder createdAt'),
    Sector.find({ isActive: true }).select('-formFields').sort('sortOrder createdAt'),
    findPublic({ featured: 'true' }, HOME_PRODUCTS_LIMIT),
    findPublic({ onSale: 'true' }, HOME_PRODUCTS_LIMIT),
  ]);

  res.json({ success: true, data: { settings, banners, categories, sectors, featured, offers } });
});
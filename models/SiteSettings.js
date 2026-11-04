const { Schema, model } = require('mongoose');
const { localizedSchema, fileSchema, money } = require('./shared');

// One single document for the whole site (key is always "main")
const settingsSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true, immutable: true },

    companyName: localizedSchema,
    topBarText: localizedSchema, // the thin bar above the navbar
    about: localizedSchema,
    address: localizedSchema,
    workingHours: localizedSchema,

    phone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    social: {
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      youtube: { type: String, trim: true },
      tiktok: { type: String, trim: true },
    },

    logo: fileSchema,
    shippingFee: money({ min: [0, 'Shipping fee cannot be negative'], default: 0 }), // piasters
  },
  { timestamps: true }
);

// Returns the settings document, creating it the first time
settingsSchema.statics.getMain = async function () {
  try {
    return await this.findOneAndUpdate(
      { key: 'main' },
      { $setOnInsert: { key: 'main' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    // Two first requests at the same moment: the second one just reads it
    if (err.code === 11000) return this.findOne({ key: 'main' });
    throw err;
  }
};

module.exports = model('SiteSettings', settingsSchema);
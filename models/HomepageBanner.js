const { Schema, model } = require('mongoose');
const { localizedSchema, fileSchema } = require('./shared');

const LINK_TYPES = ['none', 'product', 'category', 'sector', 'fitout', 'url'];
const SLUG_REGEX = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
const SAFE_URL_REGEX = /^(\/(?!\/)\S*|https:\/\/\S+)$/; // "/path" or "https://..." only

const bannerSchema = new Schema(
  {
    title: { type: localizedSchema, required: [true, 'Title is required'] },
    subtitle: localizedSchema,
    buttonText: localizedSchema,
    image: fileSchema, // uploaded after creating the banner

    // Where the button goes. product / category / sector take a slug,
    // fitout takes an optional sector slug (pre-selected form), url takes "/path" or "https://..."
    linkType: { type: String, enum: LINK_TYPES, default: 'none' },
    linkValue: { type: String, trim: true, maxlength: 300 },

    sortOrder: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: Date, // schedule: shown only between these two dates
    endsAt: Date,
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false }, id: false }
);

bannerSchema.index({ isActive: 1, sortOrder: 1 });

// True when the banner is really visible on the site right now
bannerSchema.virtual('isLive').get(function () {
  const now = new Date();
  return (
    this.isActive &&
    Boolean(this.image && this.image.url) &&
    (!this.startsAt || this.startsAt <= now) &&
    (!this.endsAt || this.endsAt >= now)
  );
});

// The banners the visitors see: active, has an image, inside its schedule
bannerSchema.statics.findLive = function (now = new Date()) {
  return this.find({
    isActive: true,
    'image.url': { $exists: true },
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  }).sort('sortOrder createdAt');
};

// Database-level protection. Blocks unsafe links such as "javascript:..."
bannerSchema.pre('validate', function () {
  const value = this.linkValue || '';

  if (['product', 'category', 'sector'].includes(this.linkType) && !SLUG_REGEX.test(value)) {
    this.invalidate('linkValue', `linkValue must be a slug when linkType is "${this.linkType}"`);
  }
  if (this.linkType === 'fitout' && value && !SLUG_REGEX.test(value)) {
    this.invalidate('linkValue', 'linkValue must be a sector slug (or empty)');
  }
  if (this.linkType === 'url' && !SAFE_URL_REGEX.test(value)) {
    this.invalidate('linkValue', 'URL must start with / or https://');
  }
  if (this.linkType === 'none') this.linkValue = undefined;

  if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
    this.invalidate('endsAt', 'endsAt must be after startsAt');
  }
});

module.exports = model('HomepageBanner', bannerSchema);
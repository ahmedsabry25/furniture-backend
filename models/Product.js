const { Schema, model } = require('mongoose');
const { localizedSchema, fileSchema, money } = require('./shared');

const MAX_IMAGES = 10;

const productSchema = new Schema(
  {
    name: { type: localizedSchema, required: [true, 'Name is required'] },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sku: { type: String, required: [true, 'SKU is required'], unique: true, uppercase: true, trim: true },
    description: localizedSchema,

    category: { type: Schema.Types.ObjectId, ref: 'ProductCategory', required: [true, 'Category is required'] },
    sectors: [{ type: Schema.Types.ObjectId, ref: 'EstablishmentSector' }],

    // The first image is the main one
    images: {
      type: [fileSchema],
      validate: [(images) => images.length <= MAX_IMAGES, `A product can have up to ${MAX_IMAGES} images`],
    },

    // Prices in piasters
    price: money({ required: [true, 'Price is required'], min: [1, 'Price must be greater than zero'] }),
    discountPrice: money({ min: [1, 'Discount price must be greater than zero'] }),
    discountStartsAt: Date,
    discountEndsAt: Date,

    stock: money({ required: true, min: [0, 'Stock cannot be negative'], default: 0 }),
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    maxQtyPerOrder: { type: Number, default: 10, min: 1 },

    specifications: [{ _id: false, label: localizedSchema, value: localizedSchema }],
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      unit: { type: String, enum: ['mm', 'cm', 'm'], default: 'cm' },
    },
    materials: [localizedSchema],
    finishes: [localizedSchema],
    components: [localizedSchema], // description only (e.g. what a bedroom set contains), does not affect stock

    isFeatured: { type: Boolean, default: false },
    salesCount: { type: Number, default: 0 },
    deletedAt: Date, // soft delete
  },
  { timestamps: true, id: false, toJSON: { virtuals: true, versionKey: false } }
);

productSchema.index({ category: 1, status: 1, deletedAt: 1 });
productSchema.index({ sectors: 1, status: 1 });
productSchema.index({ isFeatured: 1, status: 1 });
productSchema.index({ price: 1 });

// THE rule for the price the customer pays. Orders and cart will use this same method
productSchema.methods.getEffectivePrice = function (now = new Date()) {
  const discount = this.discountPrice;
  if (discount == null || discount >= this.price) return this.price;
  if (this.discountStartsAt && now < this.discountStartsAt) return this.price;
  if (this.discountEndsAt && now > this.discountEndsAt) return this.price;
  return discount;
};

productSchema.virtual('effectivePrice').get(function () {
  return this.getEffectivePrice();
});
productSchema.virtual('hasActiveDiscount').get(function () {
  return this.getEffectivePrice() < this.price;
});
productSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});

// Database-level protection (the validators give friendlier messages first)
productSchema.pre('validate', function () {
  if (this.discountPrice != null && this.discountPrice >= this.price) {
    this.invalidate('discountPrice', 'Discount price must be lower than the original price');
  }
  if (this.discountStartsAt && this.discountEndsAt && this.discountEndsAt <= this.discountStartsAt) {
    this.invalidate('discountEndsAt', 'Discount end must be after its start');
  }
});

module.exports = model('Product', productSchema);
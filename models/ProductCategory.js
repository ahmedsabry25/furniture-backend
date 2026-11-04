const { Schema, model } = require('mongoose');
const { localizedSchema, fileSchema } = require('./shared');

const categorySchema = new Schema(
  {
    name: { type: localizedSchema, required: [true, 'Name is required'] },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: localizedSchema,
    image: fileSchema,
    sortOrder: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    showInNavbar: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ isActive: 1, sortOrder: 1 });

module.exports = model('ProductCategory', categorySchema);
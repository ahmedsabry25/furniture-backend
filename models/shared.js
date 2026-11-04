const { Schema } = require('mongoose');

// Bilingual text: Arabic is required, English is optional
const localizedSchema = new Schema(
  {
    ar: { type: String, required: [true, 'Arabic text is required'], trim: true, maxlength: 2000 },
    en: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

// Reference to an uploaded file (the file itself lives outside MongoDB)
const fileSchema = new Schema({
  key: { type: String, required: true },
  url: { type: String, required: true },
  mimeType: String,
  size: Number,
  originalName: String,
});

// Money is stored in piasters as a whole number: 15000 = 150.00 EGP
const money = (extra = {}) => ({
  type: Number,
  validate: {
    validator: (value) => value == null || Number.isInteger(value),
    message: 'Amount must be a whole number of piasters',
  },
  ...extra,
});

module.exports = { localizedSchema, fileSchema, money };
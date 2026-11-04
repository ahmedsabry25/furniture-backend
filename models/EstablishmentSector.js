const { Schema, model } = require('mongoose');
const { localizedSchema, fileSchema } = require('./shared');

const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'multiselect', 'boolean'];
const OPTION_TYPES = ['select', 'multiselect'];

// One field of the "fit out your establishment" form
const formFieldSchema = new Schema(
  {
    key: {
      type: String,
      required: [true, 'Field key is required'],
      match: [/^[a-z][a-zA-Z0-9_]*$/, 'Field key must start with a lowercase letter and contain letters, numbers or _ only'],
    },
    label: { type: localizedSchema, required: [true, 'Field label is required'] },
    fieldType: { type: String, enum: FIELD_TYPES, required: [true, 'Field type is required'] },
    isRequired: { type: Boolean, default: false },
    options: [
      {
        _id: false,
        value: { type: String, required: true, trim: true },
        label: { type: localizedSchema, required: true },
      },
    ],
    min: Number,
    max: Number,
    maxLength: { type: Number, min: 1, max: 2000 },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const sectorSchema = new Schema(
  {
    name: { type: localizedSchema, required: [true, 'Name is required'] },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: localizedSchema,
    image: fileSchema,
    sortOrder: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    formFields: {
      type: [formFieldSchema],
      validate: [(fields) => fields.length <= 40, 'A sector can have up to 40 form fields'],
    },
  },
  { timestamps: true }
);

sectorSchema.index({ isActive: 1, sortOrder: 1 });

// Database-level protection (the validators give friendlier messages first)
sectorSchema.pre('validate', function () {
  const keys = new Set();

  for (const field of this.formFields) {
    if (keys.has(field.key)) this.invalidate('formFields', `Duplicate field key "${field.key}"`);
    keys.add(field.key);

    if (OPTION_TYPES.includes(field.fieldType) && !field.options.length) {
      this.invalidate('formFields', `Field "${field.key}" needs at least one option`);
    }
  }
});

module.exports = model('EstablishmentSector', sectorSchema);
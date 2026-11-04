const { body } = require('express-validator');
const { localizedText } = require('./common');

const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;
const URL_OPTIONS = { protocols: ['https'], require_protocol: true };

const contactField = (field) =>
  body(field).optional({ values: 'null' }).isString().trim().matches(PHONE_REGEX)
    .withMessage(`${field} is not a valid phone number`);

const socialField = (name) =>
  body(`social.${name}`).optional({ values: 'null' }).isString().trim().isLength({ max: 300 })
    .isURL(URL_OPTIONS).withMessage(`social.${name} must be a valid https:// link`);

exports.updateSettingsRules = [
  ...localizedText('companyName', 100),
  ...localizedText('topBarText', 200),
  ...localizedText('about', 2000),
  ...localizedText('address', 300),
  ...localizedText('workingHours', 200),

  contactField('phone'),
  contactField('whatsapp'),
  body('email').optional({ values: 'null' }).isEmail().withMessage('Invalid email address'),

  body('social').optional({ values: 'null' }).isObject().withMessage('social must be an object'),
  socialField('facebook'),
  socialField('instagram'),
  socialField('youtube'),
  socialField('tiktok'),

  body('shippingFee').optional().isInt({ min: 0, max: 100000000 })
    .withMessage('shippingFee must be a whole number of piasters (0 or more)').toInt(),
];
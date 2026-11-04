const multer = require('multer');
const AppError = require('../utils/AppError');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Files are kept in memory (no disk). Max 5MB each, 10 files per request
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) =>
    ALLOWED_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new AppError('Only JPG, PNG and WEBP images are allowed', 400)),
});

// One image: req.file
exports.uploadSingle = (field) => uploader.single(field);

// Many images: req.files
exports.uploadMany = (field, max = 10) => uploader.array(field, max);

// Checks the real content (first bytes), not just the type the client claims
const looksLikeImage = (b) =>
  (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || // JPEG
  (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') || // PNG
  (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'); // WEBP

// Runs after multer. Works for req.file and req.files
exports.checkImageContent = (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);

  if (!files.every((file) => looksLikeImage(file.buffer))) {
    return next(new AppError('One or more files are not valid images', 400));
  }
  next();
};
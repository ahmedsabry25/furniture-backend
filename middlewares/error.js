module.exports = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message;
  let errors;

  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for ${Object.keys(err.keyValue || {})[0]}`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Invalid or expired token';
  } else if (err.name === 'MulterError') {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'Image is larger than 5MB';
    else if (err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Wrong file field name or too many files';
    else message = 'File upload error';
  } else if (!err.isOperational) {
    console.error(err);
    status = 500;
    message = 'Internal server error';
  }

  res.status(status).json({ success: false, message, ...(errors && { errors }) });
};
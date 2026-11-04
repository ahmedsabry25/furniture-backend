const cloudinary = require('../config/cloudinary');

// Uploads one multer memory file to Cloudinary and returns the shape we store in MongoDB
const uploadImage = (file, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `furniture/${folder}`, resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          key: result.public_id, // used later to delete the image
          url: result.secure_url,
          mimeType: file.mimetype,
          size: file.size,
          originalName: file.originalname,
        });
      }
    );
    stream.end(file.buffer);
  });

// Uploads many images. All or nothing: if one fails, the ones already uploaded are deleted
const uploadImages = async (files, folder) => {
  const results = await Promise.allSettled(files.map((file) => uploadImage(file, folder)));
  const uploaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.find((r) => r.status === 'rejected');

  if (failed) {
    await Promise.all(uploaded.map((img) => removeFile(img.key)));
    throw failed.reason;
  }
  return uploaded;
};

// Deletes an image from Cloudinary (ignores the error if it is already gone)
const removeFile = async (key) => {
  try {
    await cloudinary.uploader.destroy(key);
  } catch (err) {
    // nothing to delete
  }
};

module.exports = { uploadImage, uploadImages, removeFile };
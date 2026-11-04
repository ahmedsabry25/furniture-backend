const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('@exortek/express-mongo-sanitize');
const AppError = require('./utils/AppError');
const errorHandler = require('./middlewares/error');

const authRoutes = require('./routes/auth.routes');
const categoryRoutes = require('./routes/category.routes');
const sectorRoutes = require('./routes/sector.routes');
const productRoutes = require('./routes/product.routes');
const homeRoutes = require('./routes/home.routes');
const settingsRoutes = require('./routes/settings.routes');
const bannerRoutes = require('./routes/banner.routes');
const cartRoutes = require('./routes/cart.routes');

const app = express();

// Behind a proxy (hosting), use the real client IP (needed for rate limiting)
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(helmet());

// Only the listed frontend origins can call the API from a browser
const origins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));

app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/cart', cartRoutes);

app.use((req, res, next) => next(new AppError('Route not found', 404)));
app.use(errorHandler);

module.exports = app;
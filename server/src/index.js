require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const conversationsRouter = require('./routes/conversations');
const itemsRouter = require('./routes/items');
const projectsRouter = require('./routes/projects');
const demoRouter = require('./routes/demo');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Routes - mounted on both /api and root for serverless flexibility
const registerRoutes = (prefix = '') => {
  app.use(`${prefix}/conversations`, conversationsRouter);
  app.use(`${prefix}/items`, itemsRouter);
  app.use(`${prefix}/projects`, projectsRouter);
  app.use(`${prefix}/demo`, demoRouter);
  app.get(`${prefix}/health`, (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Nexus Signal API'
    });
  });
};

registerRoutes('/api');
registerRoutes('');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Nexus Signal API Server running on port ${PORT}`);
  });
}

module.exports = app;

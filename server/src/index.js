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

// Routes
app.use('/api/conversations', conversationsRouter);
app.use('/api/items', itemsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/demo', demoRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Nexus Signal API'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`Nexus Signal API Server running on port ${PORT}`);
});

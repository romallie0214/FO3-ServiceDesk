const express = require('express');
const cors = require('cors');
require('dotenv').config();

const ticketRoutes = require('./routes/tickets');
const userRoutes = require('./routes/users');
const commentRoutes = require('./routes/comments');
const categoryRoutes = require('./routes/categories');
const csmRoutes = require('./routes/csm');
const statusRoutes = require('./routes/statuses');
const slaRoutes = require('./routes/sla');
const knowledgeBaseRoutes = require('./routes/knowledge_base');
const publicMonitoringRoutes = require('./routes/publicMonitoring');
const serviceAreaRoutes = require('./routes/serviceAreas');

const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Security and cache-control headers.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src blob:",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' https://www.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src 'self' blob: https://www.google.com",
      "media-src 'self' blob:",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
    ].join('; ')
  );

  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // API responses can contain account, session, and ticket information.
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, private, max-age=0'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  next();
});

// Restrict cross-origin requests to explicitly trusted origins.
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header include same-origin, health-check,
      // command-line, and server-to-server requests.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`[CORS] Rejected origin: ${origin}`);

      return callback(
        new Error('Origin is not allowed by CORS policy.')
      );
    },

    // These methods are required by the ICTDesk application.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    allowedHeaders: ['Content-Type', 'Authorization'],

    // ICTDesk uses bearer tokens, not cross-origin authentication cookies.
    credentials: false,

    maxAge: 600,
    optionsSuccessStatus: 204,
  })
);

// Return a controlled response for rejected cross-origin requests.
app.use((err, req, res, next) => {
  if (err.message === 'Origin is not allowed by CORS policy.') {
    return res.status(403).json({
      error: 'Cross-origin request denied.',
    });
  }

  return next(err);
});

// Parse JSON after CORS validation.
app.use(express.json({ limit: '1mb' }));

// API routes.
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/csm', csmRoutes);
app.use('/api/statuses', statusRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/public-monitoring', publicMonitoringRoutes);
app.use('/api/service-areas', serviceAreaRoutes);

// Health endpoint.
app.get('/', (req, res) => {
  res.json({
    message: 'DSWD ICTMS API is running ✅',
  });
});

// Return JSON for unknown API routes.
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found.',
  });
});

// Prevent unhandled exceptions from exposing stack traces or server paths.
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    error: 'Internal server error.',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

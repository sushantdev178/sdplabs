// src/index.js
import express from 'express';
import cors from 'cors';
import ganttRoutes from './routes/gantt.js';
import ganttAuth from './middlewares/ganttAuth.js'; // <-- 1. Import the middleware here
import { errorResponse } from './utils/response.js';
import { DEBUG_MODE, API_PREFIX } from './config/constants.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json()); // Must be BEFORE auth so req.body is available!
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────
// 2. Inject the middleware directly into the app.use() declaration
// Now, every route inside ganttRoutes requires the HMAC signature.

// app.use(API_PREFIX, ganttAuth, ganttRoutes);
app.use(API_PREFIX, ganttRoutes);

// ─── 404 handler ─────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.url} not found`
    });
});

// ─── Global error handler ────────────────────────────────────
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    return errorResponse(res, error, 'Internal server error');
});

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Gantt calculation server running on http://localhost:${PORT}`);
    console.log(`Debug mode: ${DEBUG_MODE}`);
});
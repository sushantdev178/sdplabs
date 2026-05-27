import express from 'express';
import ganttRoutes from './routes/gantt.js';
import logger from './utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import {
    PORT,
    BASE_URL,
    LOG_DIR,
    SERVICE_NAME,
    JSON_LIMIT
} from './config/constants.js';
import cors from 'cors';

const app = express();

app.use(cors());


// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: JSON_LIMIT }));

// Request ID middleware
app.use((req, res, next) => {
    req.id = uuidv4().slice(0, 8);
    res.setHeader('X-Request-Id', req.id);
    next();
});

// Request/Response logger
app.use((req, res, next) => {
    const start = Date.now();
    const { method, originalUrl, body, id } = req;

    const oldJson = res.json;
    res.json = function (data) {
        res.locals.responseBody = data;
        return oldJson.call(this, data);
    };

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${method} ${originalUrl}`, {
            requestId: id,
            status: res.statusCode,
            duration: `${duration}ms`,
            requestBody: method !== 'GET' ? body : undefined,
            responseBody: res.locals.responseBody
        });
    });

    next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ success: true, service: SERVICE_NAME, status: 'running' });
});

app.use('/api/gantt', ganttRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, { requestId: req.id });
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found` });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.message}`, {
        requestId: req.id,
        stack: err.stack,
        url: req.originalUrl
    });
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    logger.info(`${SERVICE_NAME} started on port ${PORT}`);
    console.log(`\n✅  ${SERVICE_NAME} is running`);
    console.log(`    URL  : ${BASE_URL}`);
    console.log(`    Logs : ${LOG_DIR}/gantt-YYYY-MM-DD.log`);
    console.log(`\n    GET  /health                  — health check`);
    console.log(`    POST /api/gantt/recalculate    — run auto-scheduling`);
    console.log(`    POST /api/gantt/validate-link  — validate link before save\n`);
});
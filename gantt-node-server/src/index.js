import express from 'express';
import ganttRoutes from './routes/gantt.js';
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

// 1. Core Global Configuration
app.use(cors());

// 2. Request ID Generator & Request/Response Logger (Moved to top)
app.use((req, res, next) => {
    req.id = uuidv4(); // FIX: Explicitly assign the UUID to the request object
    const start = Date.now();
    const { method, originalUrl, body, id } = req;

    const oldJson = res.json;
    res.json = function (data) {
        res.locals.responseBody = data;
        return oldJson.call(this, data);
    };

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] [${id}] ${method} ${originalUrl} - ${res.statusCode} - ${duration}ms`);
    });

    next();
});

// 3. Body Parsers & Syntax Interceptors
app.use(express.json({ limit: JSON_LIMIT }));

app.use((err, req, res, next) => {
    // CRITICAL FIX: Direct console logging ensures visibility even if the logger object has issues
    console.error('────────────────────────────────────────────────────────');
    console.error('🚨 [CRITICAL APPLICATION ERROR]:', err.message);
    console.error('📁 STACK TRACE:\n', err.stack);
    console.error('────────────────────────────────────────────────────────');

    if (logger && typeof logger.error === 'function') {
        try {
            logger.error(`Server error: ${err.message}`, {
                requestId: req.id,
                stack: err.stack,
                url: req.originalUrl
            });
        } catch (e) {
            console.error('Fallback Logger failing internally:', e.message);
        }
    }

    res.status(500).json({ success: false, message: 'Internal server error' });
});

// 4. Application Route Mounting
app.get('/health', (req, res) => {
    res.json({ success: true, service: SERVICE_NAME, status: 'running' });
});

app.use('/api/gantt', ganttRoutes);

// 5. Fallback 404 Route Handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found` });
});

// 6. Global Catch-All Error Handler
app.use((err, req, res, next) => {
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// 7. Core Process Boot
app.listen(PORT, () => {
    console.log(`\n✅  ${SERVICE_NAME} is running`);
    console.log(`    URL  : ${BASE_URL}`);
    console.log(`    Logs : ${LOG_DIR}/gantt-YYYY-MM-DD.log`);
    console.log(`\n    GET  /health                  — health check`);
    console.log(`    POST /api/gantt/calculate     — run auto-scheduling`); // Documentation update
    console.log(`    POST /api/gantt/validate-link  — validate link before save\n`);
});
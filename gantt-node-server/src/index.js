// src/index.js
import express from 'express';
import cors from 'cors';
import ganttRoutes from './routes/gantt.js';
import { errorResponse } from './utils/response.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/gantt', ganttRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.url} not found`
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    return errorResponse(res, error, 'Internal server error');
});

app.listen(PORT, () => {
    console.log(`Gantt calculation server running on http://localhost:${PORT}`);
    console.log(`Debug mode: ${process.env.DEBUG_MODE === 'true' ? 'ON' : 'OFF'}`);
});
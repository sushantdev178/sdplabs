import mysql from 'mysql2/promise';
import logger from './logger.js';
import {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
} from '../config/constants.js';

let pool = null;

export const initDb = () => {
    if (!pool) {
        pool = mysql.createPool({
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            waitForConnections: true,
            connectionLimit: 3,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            dateStrings: true,
        });
        logger.info('MySQL connection pool created');
    }
    return pool;
};

export const query = async (sql, params = []) => {
    const start = Date.now();
    try {
        const [rows] = await pool.query(sql, params);
        logger.debug('DB Query', {
            sql,
            params,
            duration: `${Date.now() - start}ms`,
            rowCount: rows.length
        });
        return rows;
    } catch (error) {
        logger.error('DB Query Error', { sql, params, error: error.message });
        throw error;
    }
};

// Initialize pool on startup
initDb();
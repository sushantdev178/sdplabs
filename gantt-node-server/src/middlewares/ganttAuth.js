import crypto from 'crypto';
import { HMAC_TIME_WINDOW_SECONDS, GANTT_NODE_SECRET } from '../config/constants.js'; // Import your new constant

const ganttAuth = (req, res, next) => {
    try {
        let payload;

        // 1. Strict Case-Based Method Filtering
        switch (req.method) {
            case 'GET':
                payload = req.query; // GET requests use URL parameters
                break;
            case 'POST':
                payload = req.body || {}; // POST requests use JSON body
                break;
            default:
                // Instantly drop PUT, DELETE, PATCH, OPTIONS, etc.
                return res.status(405).json({
                    success: false,
                    error: `Method Not Allowed: ${req.method} is not supported by this endpoint.`
                });
        }

        // 2. Check if header exists and is correctly formatted
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || !apiKey.includes('.')) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Missing or malformed x-api-key header'
            });
        }

        // 3. Split the header into the timestamp and the Laravel signature
        const [timestampStr, clientSignature] = apiKey.split('.');
        const requestTimestamp = parseInt(timestampStr, 10);
        const currentUnixTime = Math.floor(Date.now() / 1000);

        // 4. The Clock Check: Use the imported constant instead of a hardcoded 10
        if (isNaN(requestTimestamp) || Math.abs(currentUnixTime - requestTimestamp) > HMAC_TIME_WINDOW_SECONDS) {
            return res.status(403).json({
                success: false,
                error: `Forbidden: Request expired (Max window: ${HMAC_TIME_WINDOW_SECONDS}s) or invalid timestamp`
            });
        }

        // 5. Extract the IDs from the conditionally assigned payload
        const { workspace_id, project_id } = payload;

        if (!workspace_id || !project_id) {
            return res.status(400).json({
                success: false,
                error: `Bad Request: Missing workspace_id or project_id in ${req.method === 'GET' ? 'URL parameters' : 'JSON body'}`
            });
        }

        // 6. Rebuild the exact string Laravel signed
        const dataToSign = `${workspace_id}|${project_id}|${requestTimestamp}`;
        const secret = GANTT_NODE_SECRET;

        console.log('Gantt Auth Middleware Debug:', secret, dataToSign, clientSignature);

        if (!secret) {
            console.error('CRITICAL: GANTT_NODE_SECRET is not defined in constants.');
            return res.status(500).json({ success: false, error: 'Internal Server Error' });
        }

        // 7. Calculate what the signature *should* be
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(dataToSign)
            .digest('hex');

        // 8. Use standard constant-time string comparison
        // We use crypto.timingSafeEqual on the raw strings, but we MUST ensure 
        // they are the exact same length first to prevent throwing an error.

        if (clientSignature.length !== expectedSignature.length) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Signature length mismatch'
            });
        }

        // console.log('Gantt Auth Middleware Debug:', clientSignature, expectedSignature)

        console.log({
            apiKey: req.headers['x-api-key'],
            workspace_id,
            project_id,
            requestTimestamp,
            dataToSign,
            clientSignature,
            expectedSignature,
        });

        // Compare the strings securely!
        if (!crypto.timingSafeEqual(Buffer.from(clientSignature), Buffer.from(expectedSignature))) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Cryptographic signature verification failed'
            });
        }

        // Authentication successful! Proceed to the controller.
        next();

    } catch (error) {
        console.error('Gantt Auth Middleware Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error during authentication'
        });
    }
};

export default ganttAuth;
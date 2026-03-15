/**
 * WeaveMind — ML Service Proxy
 * Forwards multipart image uploads from Node.js backend to Python FastAPI ML service.
 * ML service must be running on port 8000.
 */

const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const { protect } = require('../middleware/auth');
const { QualityLog } = require('../models/Schemas');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Helper: forward request body to ML service
async function proxyToML(path, method, body, contentType) {
    return new Promise((resolve, reject) => {
        const url = new URL(ML_URL + path);
        const lib = url.protocol === 'https:' ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(body) }
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data }); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ─── GET /api/ml/health ───────────────────────────────────────────────────────
router.get('/health', protect, async (req, res) => {
    try {
        const r = await proxyToML('/health', 'GET', '', 'application/json');
        res.json(r.data);
    } catch (err) {
        res.status(503).json({ status: 'offline', error: 'ML service not reachable. Start it with: uvicorn main:app --port 8000', url: ML_URL });
    }
});

// ─── GET /api/ml/model-info ───────────────────────────────────────────────────
router.get('/model-info', protect, async (req, res) => {
    try {
        const r = await proxyToML('/model/info', 'GET', '', 'application/json');
        res.json(r.data);
    } catch (err) {
        res.status(503).json({ error: 'ML service offline' });
    }
});

// ─── POST /api/ml/detect ─────────────────────────────────────────────────────
// Receives multipart/form-data from frontend, forwards to ML service,
// then auto-logs quality result to MongoDB.
router.post('/detect', protect, async (req, res) => {
    try {
        // Forward the raw request body (multipart) to ML service
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
            const body = Buffer.concat(chunks);
            const contentType = req.headers['content-type'];

            let mlRes;
            try {
                mlRes = await proxyRaw(`${ML_URL}/detect`, 'POST', body, contentType);
            } catch (e) {
                return res.status(503).json({ error: 'ML service offline. Run: cd ml_service && uvicorn main:app --port 8000' });
            }

            const result = mlRes.data;

            // Auto-log to QualityLog collection
            if (result.grade && result.batch_id) {
                try {
                    const defectsForDB = Object.entries(result.defect_summary || {}).map(([type, count]) => ({
                        type: type === 'BrokenYarn' ? 'BrokenYarn' : type,
                        count,
                        severity: result.detections?.find(d => d.class === type)?.severity || 'Medium'
                    }));

                    const log = await QualityLog.create({
                        batchId: result.batch_id || `BATCH-${Date.now()}`,
                        machineId: result.machine_id || 'AI-SCAN',
                        defects: defectsForDB,
                        totalDefects: result.total_defects,
                        grade: result.grade,
                        aiDetected: true,
                        inspectorId: req.user._id
                    });

                    result.logged_to_db = true;
                    result.quality_log_id = log._id;

                    // Emit machine stop alert if needed
                    if (result.trigger_machine_stop) {
                        req.io.emit('quality_alert', {
                            machineId: result.machine_id,
                            msg: result.alert_message,
                            grade: result.grade,
                            defects: result.total_defects
                        });
                    }
                } catch (dbErr) {
                    result.db_error = dbErr.message;
                }
            }

            res.status(mlRes.status).json(result);
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Raw proxy helper for binary/multipart
function proxyRaw(url, method, body, contentType) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : http;

        const options = {
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname,
            method,
            headers: { 'Content-Type': contentType, 'Content-Length': body.length }
        };

        const req = lib.request(options, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) }); }
                catch { resolve({ status: res.statusCode, data: {} }); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

module.exports = router;

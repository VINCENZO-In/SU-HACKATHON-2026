const express = require('express');
const router = express.Router();
const m = require('../controllers/maintenanceController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, m.getAllStatus);
router.get('/summary', protect, m.getSummary);
router.get('/check-alerts', protect, m.checkAllAlerts);
router.get('/:id', protect, m.getDetail);
router.post('/:id/log', protect, authorize('admin', 'manager'), m.logMaintenance);
router.post('/:id/runtime', protect, m.addRuntime);

module.exports = router;

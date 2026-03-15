const express = require('express');
const router = express.Router();
const e = require('../controllers/energyController');
const { protect, authorize } = require('../middleware/auth');

router.get('/report', protect, e.getReport);
router.get('/load', protect, e.getLoadDistribution);
router.post('/auto-switch', protect, authorize('admin', 'manager'), e.autoSwitch);
router.post('/alert-test', protect, e.triggerLoadAlert);

module.exports = router;

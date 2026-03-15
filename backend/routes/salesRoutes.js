const express = require('express');
const router = express.Router();
const s = require('../controllers/salesController');
const { protect } = require('../middleware/auth');

router.get('/prediction', protect, s.getSalesPrediction);
router.get('/monthly', protect, s.getMonthlyReport);

module.exports = router;

const express = require('express');
const router = express.Router();
const q = require('../controllers/qualityController');
const { protect } = require('../middleware/auth');

router.get('/', protect, q.getAll);
router.post('/', protect, q.submit);
router.get('/stats', protect, q.getStats);

module.exports = router;

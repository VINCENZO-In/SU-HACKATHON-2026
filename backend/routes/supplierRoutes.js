const express = require('express');
const router = express.Router();
const s = require('../controllers/supplierController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, s.getAll);
router.get('/risk', protect, s.getRiskAnalysis);
router.get('/best/:material', protect, s.getBestForMaterial);
router.post('/', protect, authorize('admin', 'manager'), s.create);
router.put('/:id', protect, authorize('admin', 'manager'), s.update);
router.delete('/:id', protect, authorize('admin'), s.remove);
router.post('/:id/delivery', protect, s.addDelivery);

module.exports = router;

const express = require('express');
const router = express.Router();
const c = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, c.getAll);
router.get('/low-stock', protect, c.checkStock);
router.get('/barcode/:barcode', protect, c.getByBarcode);
router.post('/', protect, authorize('admin', 'manager'), c.create);
router.put('/:id', protect, authorize('admin', 'manager'), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);
router.post('/track', protect, c.trackMovement);
router.post('/scan-qr', protect, c.scanQR);
router.post('/:id/qr', protect, c.generateQR);

module.exports = router;

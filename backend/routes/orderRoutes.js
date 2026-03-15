const express = require('express');
const router = express.Router();
const o = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, o.getOrders);
router.post('/', protect, authorize('admin', 'manager'), o.createOrder);
router.put('/:id', protect, authorize('admin', 'manager'), o.updateOrder);

router.get('/ledger', protect, o.getLedger);
router.post('/ledger', protect, authorize('admin', 'manager'), o.createLedgerEntry);
router.get('/cashflow', protect, o.getCashFlow);
router.get('/stats', protect, o.getDashboardStats);

module.exports = router;

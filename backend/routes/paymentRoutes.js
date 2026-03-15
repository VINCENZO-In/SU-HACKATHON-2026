const express = require('express');
const router = express.Router();
const p = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.get('/overdue', protect, p.getOverdue);
router.get('/upcoming', protect, p.getUpcoming);
router.post('/auto-reminders', protect, authorize('admin', 'manager'), p.runAutoReminders);
router.post('/:id/send-reminder', protect, authorize('admin', 'manager'), p.sendReminder);
router.put('/:id/mark-paid', protect, authorize('admin', 'manager'), p.markPaid);

module.exports = router;

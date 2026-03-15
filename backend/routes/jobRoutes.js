const express = require('express');
const router = express.Router();
const j = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, j.getAll);
router.get('/gantt', protect, j.getGanttData);
router.post('/', protect, authorize('admin', 'manager'), j.create);
router.put('/:id', protect, j.update);
router.delete('/:id', protect, authorize('admin', 'manager'), j.remove);
router.post('/:id/assign', protect, authorize('admin', 'manager'), j.assignToMachine);
router.post('/optimize', protect, authorize('admin', 'manager'), j.optimizeSchedule);

module.exports = router;

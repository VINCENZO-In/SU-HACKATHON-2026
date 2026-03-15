const express = require('express');
const router = express.Router();
const m = require('../controllers/machineController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, m.getMachines);
router.get('/:id', protect, m.getMachine);
router.post('/', protect, authorize('admin', 'manager'), m.createMachine);
router.put('/:id', protect, authorize('admin', 'manager'), m.updateMachine);
router.get('/:id/sensors', protect, m.getMachineSensors);
router.get('/:id/maintenance', protect, m.getMaintenanceForecast);
router.post('/:id/simulate', protect, m.simulateSensor);

module.exports = router;

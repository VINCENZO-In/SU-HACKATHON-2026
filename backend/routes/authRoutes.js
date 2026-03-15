const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.get('/me', protect, auth.getMe);
router.get('/users', protect, authorize('admin', 'manager'), auth.getUsers);
router.put('/users/:id', protect, authorize('admin'), auth.updateUser);
router.delete('/users/:id', protect, authorize('admin'), auth.deleteUser);

module.exports = router;

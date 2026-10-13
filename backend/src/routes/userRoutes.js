const express = require('express');
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  updateMe,
  dashboardStats,
  myNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  auditLogsList,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Self profile (note: placed before /:id to avoid 'me' being captured)
router.put('/me', protect, updateMe);

// Dashboard analytics
router.get('/stats', protect, dashboardStats);

// Notifications
router.get('/notifications', protect, myNotifications);
router.put('/notifications/read-all', protect, markAllNotificationsRead);
router.put('/notifications/:id/read', protect, markNotificationRead);

// Admin-only user management
router.get('/', protect, authorize('admin'), listUsers);
router.post('/', protect, authorize('admin'), createUser);
router.put('/:id', protect, authorize('admin'), updateUser);
router.delete('/:id', protect, authorize('admin'), deleteUser);

// Audit logs (admin)
router.get('/audit-logs', protect, authorize('admin'), auditLogsList);

module.exports = router;
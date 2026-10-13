const Notification = require('../models/Notification');
const { collection } = require('../storage/storage');

/**
 * Creates a notification row. Also returns it so routes/socket can push it.
 */
async function createNotification({ userId, type = 'info', title = '', message, link = '' }) {
  const notifications = collection('notifications', Notification);
  const record = await notifications.insertOne({ userId, type, title, message, read: false, link });
  return record;
}

module.exports = { createNotification };
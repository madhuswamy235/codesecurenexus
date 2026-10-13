/**
 * Role-based authorization guard. Usage:
 *   router.post('/', protect, authorize('admin'), handler)
 */
const ROLES = ['admin', 'recruiter', 'interviewer', 'candidate'];

function authorize(...allowed) {
  return (req, res, next) => {
    const role = req.userRole || (req.user && req.user.role);
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Requires role: ${allowed.join(', ')}.`,
      });
    }
    next();
  };
}

module.exports = { authorize, ROLES };
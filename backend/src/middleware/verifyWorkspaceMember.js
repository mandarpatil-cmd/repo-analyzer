const Workspace = require('../models/Workspace.model');

const verifyWorkspaceMember = (allowedRoles = ['admin', 'member', 'viewer']) => {
  return async (req, res, next) => {
    try {
      const { workspaceId } = req.params;
      const userId = req.user.id;

      if (!workspaceId) {
        return res.status(400).json({ success: false, message: 'workspaceId is required in URL parameters' });
      }

      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace not found' });
      }

      const member = workspace.members.find((m) => m.userId.toString() === userId);
      if (!member) {
        return res.status(403).json({ success: false, message: 'You are not a member of this workspace' });
      }

      if (!allowedRoles.includes(member.role)) {
        return res.status(403).json({ success: false, message: `Role '${member.role}' is not authorized for this action` });
      }

      req.workspaceRole = member.role;
      req.workspace = workspace;
      next();
    } catch (err) {
      console.error('verifyWorkspaceMember error:', err.message);
      res.status(500).json({ success: false, message: 'Server error while verifying workspace membership' });
    }
  };
};

module.exports = verifyWorkspaceMember;

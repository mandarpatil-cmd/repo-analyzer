const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspace.controller');
const verifyToken = require('../middleware/verifyToken');
const verifyWorkspaceMember = require('../middleware/verifyWorkspaceMember');

router.use(verifyToken);

// Workspace CRUD
router.post('/', workspaceController.createWorkspace);
router.get('/', workspaceController.listMyWorkspaces);
router.get('/:workspaceId', verifyWorkspaceMember(['admin', 'member', 'viewer']), workspaceController.getWorkspace);
router.delete('/:workspaceId', verifyWorkspaceMember(['admin']), workspaceController.deleteWorkspace);
router.post('/:workspaceId/transfer', verifyWorkspaceMember(['admin']), workspaceController.transferOwnership);
// Members
router.post('/:workspaceId/members', verifyWorkspaceMember(['admin']), workspaceController.inviteMember);
router.patch('/:workspaceId/members/:memberId/role', verifyWorkspaceMember(['admin']), workspaceController.changeMemberRole);
router.delete('/:workspaceId/members/:memberId', verifyWorkspaceMember(['admin']), workspaceController.removeMember);
router.get('/:workspaceId/members', verifyWorkspaceMember(['admin', 'member', 'viewer']), workspaceController.listMembers);

// Analyses
router.get('/:workspaceId/analyses', verifyWorkspaceMember(['admin', 'member', 'viewer']), workspaceController.listWorkspaceAnalyses);
router.post('/:workspaceId/analyses/:analysisId/assign', verifyWorkspaceMember(['admin', 'member']), workspaceController.assignAnalysisToWorkspace);

// Annotations
router.get('/:workspaceId/analyses/:analysisId/annotations', verifyWorkspaceMember(['admin', 'member', 'viewer']), workspaceController.listAnnotations);
router.post('/:workspaceId/analyses/:analysisId/annotations', verifyWorkspaceMember(['admin', 'member']), workspaceController.createAnnotation);
router.patch('/:workspaceId/analyses/:analysisId/annotations/:annotId', verifyWorkspaceMember(['admin', 'member']), workspaceController.updateAnnotation);
router.delete('/:workspaceId/analyses/:analysisId/annotations/:annotId', verifyWorkspaceMember(['admin', 'member']), workspaceController.deleteAnnotation);
router.post('/:workspaceId/analyses/:analysisId/annotations/:annotId/reply', verifyWorkspaceMember(['admin', 'member']), workspaceController.addReply);
router.patch('/:workspaceId/analyses/:analysisId/annotations/:annotId/resolve', verifyWorkspaceMember(['admin', 'member']), workspaceController.resolveAnnotation);

module.exports = router;

const { nanoid } = require('nanoid');
const Workspace = require('../models/Workspace.model');
const Analysis = require('../models/Analysis.model');
const Annotation = require('../models/Annotation.model');
const User = require('../models/User.model');

exports.createWorkspace = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Workspace name is required' });

    const slug = nanoid(8);
    const workspace = await Workspace.create({
      name,
      slug,
      ownerId: req.user.id,
      members: [{ userId: req.user.id, role: 'admin' }],
    });

    res.status(201).json({ success: true, workspace });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listMyWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.userId': req.user.id })
      .populate('members.userId', 'name email avatar')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, workspaces });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId)
      .populate('members.userId', 'name email avatar');
    res.status(200).json({ success: true, workspace });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    await Workspace.findByIdAndDelete(workspaceId);
    
    // Unlink analyses and delete annotations
    await Analysis.updateMany({ workspaceId }, { workspaceId: null });
    await Annotation.deleteMany({ workspaceId });
    
    res.status(200).json({ success: true, message: 'Workspace deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.inviteMember = async (req, res) => {
  try {
    const { email, role } = req.body;
    const userToInvite = await User.findOne({ email });
    if (!userToInvite) {
      return res.status(404).json({ success: false, message: 'User not found. They must register first.' });
    }

    const workspace = req.workspace;
    const isMember = workspace.members.some(m => m.userId.toString() === userToInvite._id.toString());
    
    if (isMember) {
      return res.status(400).json({ success: false, message: 'User is already a member' });
    }

    if (workspace.plan === 'free' && workspace.members.length >= 3) {
      return res.status(403).json({ success: false, message: 'Free plan limit reached (max 3 members).' });
    }

    workspace.members.push({ userId: userToInvite._id, role: role || 'member' });
    await workspace.save();
    
    await workspace.populate('members.userId', 'name email avatar');
    res.status(200).json({ success: true, members: workspace.members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.changeMemberRole = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { role } = req.body;
    const workspace = req.workspace;

    const member = workspace.members.find(m => m.userId.toString() === memberId);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    
    // Cannot change owner's role
    if (workspace.ownerId.toString() === memberId) {
       return res.status(400).json({ success: false, message: 'Cannot change the owner role' });
    }

    member.role = role;
    await workspace.save();
    
    await workspace.populate('members.userId', 'name email avatar');
    res.status(200).json({ success: true, members: workspace.members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.transferOwnership = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { newOwnerId } = req.body;
    const workspace = req.workspace;

    if (workspace.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the current owner can transfer ownership' });
    }

    const newOwnerMember = workspace.members.find(m => m.userId.toString() === newOwnerId);
    if (!newOwnerMember) {
      return res.status(404).json({ success: false, message: 'New owner must be an existing member' });
    }

    workspace.ownerId = newOwnerId;
    newOwnerMember.role = 'admin'; // ensure new owner is an admin
    await workspace.save();
    
    await workspace.populate('members.userId', 'name email avatar');
    res.status(200).json({ success: true, workspace, members: workspace.members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const workspace = req.workspace;

    if (workspace.ownerId.toString() === memberId) {
       return res.status(400).json({ success: false, message: 'Cannot remove the owner' });
    }

    workspace.members = workspace.members.filter(m => m.userId.toString() !== memberId);
    await workspace.save();
    
    await workspace.populate('members.userId', 'name email avatar');
    res.status(200).json({ success: true, members: workspace.members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listMembers = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId).populate('members.userId', 'name email avatar');
    res.status(200).json({ success: true, members: workspace.members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listWorkspaceAnalyses = async (req, res) => {
  try {
    const analyses = await Analysis.find({ workspaceId: req.params.workspaceId })
      .select('repoUrl repoFullName status analyzedAt summary.repoName metadata.stars metadata.primaryLanguage');
    res.status(200).json({ success: true, analyses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.assignAnalysisToWorkspace = async (req, res) => {
  try {
    const { workspaceId, analysisId } = req.params;
    const analysis = await Analysis.findOne({ _id: analysisId, userId: req.user.id });
    
    if (!analysis) return res.status(404).json({ success: false, message: 'Analysis not found or you do not own it' });
    
    analysis.workspaceId = workspaceId;
    await analysis.save();
    res.status(200).json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listAnnotations = async (req, res) => {
  try {
    const { workspaceId, analysisId } = req.params;
    const { targetType, identifier } = req.query;

    const query = { workspaceId, analysisId };
    if (targetType) query['target.type'] = targetType;
    if (identifier) query['target.identifier'] = identifier;

    const annotations = await Annotation.find(query)
      .populate('authorId', 'name email avatar')
      .populate('replies.authorId', 'name email avatar')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, annotations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAnnotation = async (req, res) => {
  try {
    const { workspaceId, analysisId } = req.params;
    const { target, body } = req.body;

    const annotation = await Annotation.create({
      workspaceId,
      analysisId,
      authorId: req.user.id,
      target,
      body,
    });

    await annotation.populate('authorId', 'name email avatar');
    res.status(201).json({ success: true, annotation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAnnotation = async (req, res) => {
  try {
    const { annotId } = req.params;
    const { body } = req.body;
    
    const annotation = await Annotation.findOneAndUpdate(
      { _id: annotId, authorId: req.user.id },
      { body, updatedAt: Date.now() },
      { new: true }
    ).populate('authorId', 'name email avatar').populate('replies.authorId', 'name email avatar');

    if (!annotation) return res.status(404).json({ success: false, message: 'Annotation not found or unauthorized' });

    res.status(200).json({ success: true, annotation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteAnnotation = async (req, res) => {
  try {
    const { annotId } = req.params;
    const annotation = await Annotation.findOne({ _id: annotId });
    if (!annotation) return res.status(404).json({ success: false, message: 'Annotation not found' });
    
    // Only author or workspace admin can delete
    if (annotation.authorId.toString() !== req.user.id && req.workspaceRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await Annotation.deleteOne({ _id: annotId });
    res.status(200).json({ success: true, message: 'Annotation deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addReply = async (req, res) => {
  try {
    const { annotId } = req.params;
    const { body } = req.body;

    const annotation = await Annotation.findById(annotId);
    if (!annotation) return res.status(404).json({ success: false, message: 'Annotation not found' });

    annotation.replies.push({ authorId: req.user.id, body });
    annotation.updatedAt = Date.now();
    await annotation.save();

    await annotation.populate('authorId', 'name email avatar');
    await annotation.populate('replies.authorId', 'name email avatar');
    
    res.status(201).json({ success: true, annotation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resolveAnnotation = async (req, res) => {
  try {
    const { annotId } = req.params;
    const { resolved } = req.body;

    const annotation = await Annotation.findById(annotId);
    if (!annotation) return res.status(404).json({ success: false, message: 'Annotation not found' });

    if (annotation.authorId.toString() !== req.user.id && req.workspaceRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    annotation.resolved = resolved;
    annotation.updatedAt = Date.now();
    await annotation.save();

    await annotation.populate('authorId', 'name email avatar');
    await annotation.populate('replies.authorId', 'name email avatar');

    res.status(200).json({ success: true, annotation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

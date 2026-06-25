const mongoose = require('mongoose');
const { Schema } = mongoose;

const WorkspaceSchema = new Schema({
  name:        { type: String, required: true },
  slug:        { type: String, unique: true },         // nanoid(8) — used in URLs
  ownerId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: [
    {
      userId:  { type: Schema.Types.ObjectId, ref: 'User' },
      role:    { type: String, enum: ['admin', 'member', 'viewer'], default: 'member' },
      joinedAt:{ type: Date, default: Date.now },
    }
  ],
  plan:        { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('Workspace', WorkspaceSchema);

const mongoose = require('mongoose');
const { Schema } = mongoose;

const AnnotationSchema = new Schema({
  workspaceId:  { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  analysisId:   { type: Schema.Types.ObjectId, ref: 'Analysis', required: true },
  authorId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  target: {
    type:       { type: String, enum: ['file', 'function', 'insight', 'general'] },
    identifier: { type: String },  // file path, function name, or insight key
    line:       { type: Number },  // optional
  },
  body:         { type: String, required: true },   // markdown
  resolved:     { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now },
  replies: [
    {
      authorId: { type: Schema.Types.ObjectId, ref: 'User' },
      body:     { type: String },
      createdAt:{ type: Date, default: Date.now },
    }
  ],
});

module.exports = mongoose.model('Annotation', AnnotationSchema);

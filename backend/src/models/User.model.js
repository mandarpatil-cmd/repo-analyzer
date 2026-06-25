const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },

    // ─── UPDATED: now links to Analysis documents ─────────────
    savedRepos: [
      {
        repoUrl: String,
        repoFullName: String,
        analysisId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Analysis',
        },
        analyzedAt: { type: Date, default: Date.now },
      },
    ],

    // ─── For future Phase 2 (GitHub OAuth) ────────────────────
    githubId: { type: String, default: null },
    githubUsername: { type: String, default: null },
    githubAccessToken: { type: String, default: null }, // we'll encrypt later
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
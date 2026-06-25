const mongoose = require('mongoose');
const Analysis = require('./src/models/Analysis.model');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/repo-analyzer', { serverSelectionTimeoutMS: 5000 });
    
    const all = await Analysis.find().lean().limit(3);
    console.log('Total analyses count:', await Analysis.countDocuments());
    console.log('\nFirst 3 analyses:');
    all.forEach((a, i) => {
      console.log(`\n[${i+1}] ID: ${a._id}`);
      console.log('    Repo:', a.repoFullName || a.repoName);
      console.log('    Has aiInsights:', !!a.aiInsights);
      if (a.aiInsights) {
        const keys = Object.keys(a.aiInsights);
        console.log('    AI Keys:', keys);
      }
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();

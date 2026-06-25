const mongoose = require('mongoose');
const Integration = require('./src/models/Integration.model');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const intg = await Integration.findOne({ apiKey: 'edai_automated_test_key_123' }).lean();
  console.log("DB RECORD:", intg);
  process.exit(0);
}
run();

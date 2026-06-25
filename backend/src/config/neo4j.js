const neo4j = require('neo4j-driver');

let driver;

const connectNeo4j = async () => {
  try {
    driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
    );
    await driver.verifyConnectivity();
    console.log('✅ Neo4j Connected');
  } catch (err) {
    console.error('❌ Neo4j Connection Failed:', err.message);
  }
};

const getDriver = () => {
  if (!driver) throw new Error('Neo4j driver not initialized. Call connectNeo4j() first.');
  return driver;
};

module.exports = { connectNeo4j, getDriver };
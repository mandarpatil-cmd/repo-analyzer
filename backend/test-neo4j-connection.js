const neo4j = require('neo4j-driver');

const uri = 'neo4j://127.0.0.1:7687';
const credentialsToTry = [
  { user: 'neo4j', pass: 'neo4j' },
  { user: 'neo4j', pass: '505c4c5e-9379-4510-8f6f-7aae47ff3fcf' },
  { user: 'neo4j', pass: 'password' },
  { user: '505c4c5e-9379-4510-8f6f-7aae47ff3fcf', pass: 'neo4j' },
  { user: '505c4c5e-9379-4510-8f6f-7aae47ff3fcf', pass: '' },
];

(async () => {
  for (const cred of credentialsToTry) {
    console.log(`Trying username: "${cred.user}" and password: "${cred.pass}"...`);
    const driver = neo4j.driver(uri, neo4j.auth.basic(cred.user, cred.pass));
    try {
      await driver.verifyConnectivity();
      console.log(`SUCCESS! Username: "${cred.user}" and password: "${cred.pass}" worked!`);
      await driver.close();
      process.exit(0);
    } catch (err) {
      console.log(`FAILED for "${cred.user}":"${cred.pass}":`, err.message);
      await driver.close();
    }
  }
  console.log('None of the pre-configured credentials worked.');
  process.exit(1);
})();

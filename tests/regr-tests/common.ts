const JIFFClient = require('../../lib/jiff-client.js');

async function createClient(baseUrl: string, computation_id: string, options: any) {
  const clientOptions = { ...options };
  const client = new JIFFClient(baseUrl, computation_id, clientOptions);
  await client.initPromise;
  return client;
}
module.exports = createClient;

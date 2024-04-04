describe('JIFF Preprocessing Operations', () => {
  let jiffClients: any[] = [];
  let jiffServer: any;
  let server: any;
  const entries: { [key: number]: number } = { 1: 60, 2: 50 };
  let computation_id = 'test-bit-preprocessing';
  const party_count = 2;

  beforeEach(async () => {
    // Server Setup
    let port: number = 8115;
    const init_server = require('./server');
    const jiff_s_bignumber = require('../../lib/ext/jiff-server-bignumber.js');
    const extensions = [jiff_s_bignumber];
    const servers = init_server(port, extensions);
    (jiffServer = servers[0]), (server = servers[1]);
    await new Promise((resolve) => server.on('listening', resolve)); // Wait for server to be ready

    // Client Setup
    const JIFFClient = require('../../lib/jiff-client.js');
    const baseUrl = `http://localhost:${port}`;
    const options = {
      party_count: party_count,
      crypto_provider: true
    };

    jiffClients = Array.from({ length: party_count }, () => new JIFFClient(baseUrl, computation_id, options));
    const jiff_bignumber = require('../../lib/ext/jiff-client-bignumber.js');
    const jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint.js');

    async function apply_extension(jiff: any) {
      await jiff.apply_extension(jiff_bignumber, options);
      await jiff.apply_extension(jiff_fixedpoint, options);
    }
    await Promise.all(jiffClients.map(apply_extension));
  });

  afterEach(async () => {
    // Shutting down client
    await Promise.all(jiffClients.map((client) => client.socket.disconnect()));

    // Shutting down Server
    await jiffServer.closeAllSockets();
    await jiffServer.freeComputation(computation_id);
  });

  it('should correctly preprocess bitwise operation and return 3000', async () => {
      async function bit_smult(jiffClient: any, id: number) {
        await jiffClient.preprocessing('smult', 2, 'bits', null, null, null, null, null, { div: false });
        await jiffClient.preprocessing('open', 1);
        return new Promise((resolve, reject) => {
          jiffClient.wait_for([1, 2], async () => {
            try {
              const jiff_bits = await jiffClient.protocols.bits;
              const input = await jiff_bits.share(entries[id]);
              let sec_ttl = await jiff_bits.smult(await input[1], await input[2]);
              const result = await jiff_bits.open(sec_ttl);
              resolve(result.toString(10));
            } catch (error) {
              reject(error);
            }
          });
        });
      }
  
      const results = await Promise.all(jiffClients.map((client, idx) => bit_smult(client, idx + 1)));
      results.map((res) => expect(res).toEqual('3000'));
  }, 25000);

});

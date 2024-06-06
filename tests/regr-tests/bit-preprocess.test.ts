describe('JIFF Preprocessing Operations', () => {
  const init_server = require('./server');
  const createClient = require('./common');
  const jiff_s_bignumber = require('../../lib/ext/jiff-server-bignumber.js');
  const jiff_bignumber = require('../../lib/ext/jiff-client-bignumber.js');
  const jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint.js');

  let jiffClients: any[] = [];
  let jiffServer: any;
  let server: any;
  const entries: { [key: number]: number } = { 1: 60, 2: 50 };
  const computation_id = 'test-bit-preprocessing';
  const party_count = 2;

  beforeEach(async () => {
    // Server Setup
    const port: number = 8115;
    const extensions = [jiff_s_bignumber];
    const servers = init_server(port, extensions);
    (jiffServer = servers[0]), (server = servers[1]);
    await new Promise((resolve) => server.on('listening', resolve)); // Wait for server to be ready

    // Client Setup
    const baseUrl = `http://localhost:${port}`;
    const options = {
      party_count: party_count,
      crypto_provider: true
    };

    jiffClients = await Promise.all(Array.from({ length: party_count }, (_, index) => createClient(baseUrl, computation_id, options, index)));

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
    function bit_smult(jiffClient: any, id: number) {
      jiffClient.preprocess.api.preprocessing('smult', 2, null, null, null, null, null, null, { div: false });
      jiffClient.preprocess.api.preprocessing('open', 1);
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            await jiffClient.preprocess.api.executePreprocessing(async function () {
              const jiff_bits = jiffClient.protocols.bits;
              const input = await jiff_bits.share(entries[id]);
              const sec_ttl = await jiff_bits.smult(input[1], input[2]);
              const result = await jiff_bits.open(sec_ttl);
              resolve(result.toString(10));
            });
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

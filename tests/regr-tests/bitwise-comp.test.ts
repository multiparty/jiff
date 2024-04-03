describe('JIFF bitshare Comparison', () => {
  var jiffClients: any[] = [];
  var jiffServer: any;
  var server: any;
  const entries: { [key: number]: number } = { 1: 60, 2: 50 };
  var computation_id = 'test-bitshare-comparison';
  const party_count = 2;

  beforeEach(async () => {
    // Server Setup
    var port: number = 8116;
    const init_server = require('./server');
    const jiff_s_bignumber = require('../../lib/ext/jiff-server-bignumber.js');
    const extensions = [jiff_s_bignumber];
    const servers = await init_server(port, extensions);
    (jiffServer = servers[0]), (server = servers[1]);
    new Promise((resolve) => server.on('listening', resolve)); // Wait for server to be ready

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
    const jiff_negativenumber = require('../../lib/ext/jiff-client-negativenumber.js');

    async function apply_extension(jiff: any) {
      await jiff.apply_extension(jiff_bignumber, options);
      await jiff.apply_extension(jiff_fixedpoint, options);
      await jiff.apply_extension(jiff_negativenumber, options);
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

  it('should correctly compare with constants 60 != 50', async () => {
    async function addition(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const jiff_bits = await jiffClient.protocols.bits;
            const input = await jiff_bits.share(entries[id]);
            const comp1 = await jiff_bits.sneq(input[1], input[2]);
            // const sec_ttl = await jiff_bits.sadd(await input[1], await input[2]);
            // const comp2 = await jiff_bits.cneq(sec_ttl, 120)
            // var result = await jiff_bits.smult(comp1, comp2)
            var result = await jiff_bits.open(comp1);
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => addition(client, idx + 1)));
    results.map((res) => expect(res).toEqual('1'));
  });
});

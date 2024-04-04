describe('JIFF bitshare Comparison', () => {
  var jiffClients: any[] = [];
  var jiffServer: any;
  var server: any;
  const entries: { [key: number]: number } = { 1: 60, 2: 50 };
  var computation_id = 'test-bitshare-comparison';
  const party_count = 2;

  beforeEach(async () => {
    // Server Setup
    var port: number = 8117;
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

    async function apply_extension(jiff: any) {
      await jiff.apply_extension(jiff_bignumber, options);
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

  it('equality check should correctly function with 60 - 10 == 50 and 60 + 50 == 110(constant)', async () => {
    async function equal(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const jiff_bits = await jiffClient.protocols.bits;
            const input = await jiff_bits.share(entries[id]);
            const input1 = jiff_bits.csubl(input[1], 10);
            const comp1 = await jiff_bits.seq(input1, input[2]);
            const sec_ttl = await jiff_bits.sadd(await input[1], await input[2]);
            const comp2 = await jiff_bits.ceq(sec_ttl, 110);
            var result = await comp1.smult(comp2);
            result = await result.open();
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => equal(client, idx + 1)));
    results.map((res) => expect(res).toEqual('1'));
  });

  it('not equal should correctly function with 60 != 50 and 60 + 50 != 120(constant)', async () => {
    async function unequal(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const jiff_bits = await jiffClient.protocols.bits;
            const input = await jiff_bits.share(entries[id]);
            const comp1 = await jiff_bits.sneq(input[1], input[2]);
            const sec_ttl = await jiff_bits.sadd(input[1], input[2]);
            const comp2 = await jiff_bits.cneq(sec_ttl, 120);
            var result = await comp1.smult(comp2);
            result = await result.open();
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => unequal(client, idx + 1)));
    results.map((res) => expect(res).toEqual('1'));
  });
});

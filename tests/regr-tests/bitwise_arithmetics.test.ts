describe('JIFF bitwise Arithmetic Operations', () => {
  var jiffClients: any[] = [];
  var jiffServer: any;
  var server: any;
  const entries: { [key: number]: number } = { 1: 120, 2: 60 };
  var computation_id = 'test-bitwisse-arithmetics';
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
    jiffClients.map(async (client, _) => await apply_extension(client));
  });

  afterEach(async () => {
    // Shutting down client
    jiffClients.map(async (client, _) => await client.socket.disconnect());

    // Shutting down Server
    await jiffServer.closeAllSockets();
    await jiffServer.freeComputation(computation_id);
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  it('should correctly add 120 + 60 + 10(integer) = 190', async () => {
    async function addition(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const jiff_bits = await jiffClient.protocols.bits;
            const input = await jiff_bits.share(entries[id]);
            var sec_ttl = await jiff_bits.sadd(input[1], input[2]);
            sec_ttl = await jiff_bits.cadd(sec_ttl, 10);
            const result = await jiff_bits.open(sec_ttl);
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => addition(client, idx + 1)));
    results.map((res) => expect(res).toEqual('190'));
  });

  it('should correctly subtract 100 - (120 - 60 - 10(integer)) = 50', async () => {
    async function subtract(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const jiff_bits = await jiffClient.protocols.bits;
            const input = await jiff_bits.share(entries[id]);
            var sec_ttl = await jiff_bits.ssub(input[1], input[2]);
            sec_ttl = await jiff_bits.csubl(sec_ttl, 10);
            sec_ttl = await jiff_bits.csubr(100, sec_ttl);
            const result = await jiff_bits.open(sec_ttl);
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => subtract(client, idx + 1)));
    results.map((res) => expect(res).toEqual('50'));
  });

  // it('should correctly multiply 120 * 60 * 2(integer)) = 14400', async () => {
  //   async function division(jiffClient: any, id: number) {
  //     return new Promise((resolve, reject) => {
  //       jiffClient.wait_for([1, 2], async () => {
  //         try {
  //           const jiff_bits = await jiffClient.protocols.bits
  //           const input = await jiff_bits.share(entries[id]);
  //           var sec_ttl = await jiff_bits.smult(input[1], input[2])
  //           sec_ttl = await jiff_bits.cdivl(sec_ttl, 2)
  //           const result = await jiff_bits.open(sec_ttl);
  //           resolve(result.toString(10));
  //         } catch (error) {
  //           reject(error);
  //         }
  //       });
  //     });
  //   }

  //   const results = await Promise.all(jiffClients.map((client, idx) => division(client, idx + 1)));
  //   results.map((res) => expect(res).toEqual('14400'));
  // });

  // it('should correctly divide 100 / ((120 / 60) / 1(integer)) = 50', async () => {
  //   async function division(jiffClient: any, id: number) {
  //     return new Promise((resolve, reject) => {
  //       jiffClient.wait_for([1, 2], async () => {
  //         try {
  //           const jiff_bits = await jiffClient.protocols.bits
  //           const input = await jiff_bits.share(entries[id]);
  //           var sec_ttl = await jiff_bits.sdiv(input[1], input[2])
  //           // sec_ttl = await jiff_bits.cdivl(sec_ttl, 1)
  //           // sec_ttl = await jiff_bits.cdivr(100, sec_ttl)
  //           const result = await jiff_bits.open(sec_ttl);
  //           resolve(result.toString(10));
  //         } catch (error) {
  //           reject(error);
  //         }
  //       });
  //     });
  //   }

  //   const results = await Promise.all(jiffClients.map((client, idx) => division(client, idx + 1)));
  //   results.map((res) => expect(res).toEqual('50'));
  // });
});

describe('JIFF bitwise Arithmetic Operations', () => {
  const init_server = require('./server');
  const createClient = require('./common');
  const jiff_s_bignumber = require('../../lib/ext/jiff-server-bignumber.js');
  const jiff_bignumber = require('../../lib/ext/jiff-client-bignumber.js');
  const jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint.js');
  const jiff_negativenumber = require('../../lib/ext/jiff-client-negativenumber.js');

  let jiffClients: any[] = [];
  let jiffServer: any;
  let server: any;
  const entries: { [key: number]: number } = { 1: 60, 2: 50 };
  const computation_id = 'test-bitwisse-ops';
  const party_count = 2;

  beforeEach(async () => {
    // Server Setup
    const port: number = 8116;
    const extensions = [jiff_s_bignumber];
    const servers = await init_server(port, extensions);
    (jiffServer = servers[0]), (server = servers[1]);
    new Promise((resolve) => server.on('listening', resolve)); // Wait for server to be ready

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

  it('should correctly add 60 + 50 + 10(integer) = 120', async () => {
    async function addition(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const jiff_bits = jiffClient.protocols.bits;
            const input = await jiff_bits.share(entries[id]);
            let sec_ttl = await jiff_bits.sadd(input[1], input[2]);
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
    results.map((res) => expect(res).toEqual('120'));
  });

  it('should correctly subtract 100 - (60 - 50 - 10(integer)) = 100', async () => {
    async function subtract(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const jiff_bits = jiffClient.protocols.bits;
            const input = await jiff_bits.share(entries[id]);
            let sec_ttl = await jiff_bits.ssub(input[1], input[2]);
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
    results.map((res) => expect(res).toEqual('100'));
  }, 25000);

  it('should correctly multiply 60 * 50 = 3000', async () => {
    async function division(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const jiff_bits = jiffClient.protocols.bits;
            const input = await jiff_bits.share(entries[id]);
            const sec_ttl = await jiff_bits.smult(input[1], input[2]);
            const result = await jiff_bits.open(sec_ttl);
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => division(client, idx + 1)));
    results.map((res) => expect(res).toEqual('3000'));
  }, 25000);

  it('should correctly divide (60 / 50) = 1.2', async () => {
    async function division(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const jiff_bits = jiffClient.protocols.bits;
            const input = await jiff_bits.share(entries[id]);
            let sec_ttl = await jiff_bits.sdiv(input[1], input[2]);
            const bit_quotient = sec_ttl['quotient'];
            const bit_remainder = sec_ttl['remainder'];

            const int_quotient = await jiff_bits.open(bit_quotient);
            let int_remainder = await jiff_bits.open(bit_remainder);
            int_remainder = int_remainder.toString(10);
            const frac_remainder = parseInt(int_remainder) / entries[2];
            const result = parseInt(int_quotient.toString(10), 10) + frac_remainder;

            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => division(client, idx + 1)));
    results.map((res) => expect(res).toEqual(1.2));
  }, 25000);
});

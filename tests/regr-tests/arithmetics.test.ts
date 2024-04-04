describe('JIFF Arithmetic Operations', () => {
  let jiffClients: any[] = [];
  let jiffServer: any;
  let server: any;
  const entries: { [key: number]: number } = { 1: 60.05, 2: 60.05 };
  let computation_id = 'test-arithmetics';
  const party_count = 2;

  beforeEach(async () => {
    // Server Setup
    let port: number = 8111;
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
      crypto_provider: true,
      decimal_digits: 4,
      Zp: 562949948117
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
    Promise.all(jiffClients.map(apply_extension));
  });

  afterEach(async () => {
    // Shutting down client
    Promise.all(jiffClients.map((client) => client.socket.disconnect()));

    // Shutting down Server
    await jiffServer.closeAllSockets();
    await jiffServer.freeComputation(computation_id);
  });

  it('should correctly add 60.05 + 60.05 = 121', async () => {
    async function addition(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const input = await jiffClient.share(entries[id]);
            const sec_ttl = await input[1].add(input[2]);
            const result = await sec_ttl.open();
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => addition(client, idx + 1)));
    results.map((res) => expect(res).toEqual('120.1'));
  });

  it('should correctly subtract numbers 60.05 - 60.05 = 0', async () => {
    async function subtraction(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const input = await jiffClient.share(entries[id]);
            const sec_ttl = await input[1].sub(input[2]);
            const result = await sec_ttl.open();
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => subtraction(client, idx + 1)));
    results.map((res) => {
      expect(res).toEqual('0');
    });
  });

  it('should correctly multiply numbers 60.05 * 60.05 = 3606.0025', async () => {
    async function subtraction(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const input = await jiffClient.share(entries[id]);
            const sec_ttl = await input[1].mult(input[2]);
            const result = await sec_ttl.open();
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => subtraction(client, idx + 1)));
    results.map((res) => expect(res).toEqual('3606.0025'));
  });

  it('should correctly divide numbers 60.05 / 60.05 = 1', async () => {
    async function subtraction(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const input = await jiffClient.share(entries[id]);
            const sec_ttl = await input[1].div(input[2]);
            const result = await sec_ttl.open();
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => subtraction(client, idx + 1)));
    results.map((res) => expect(res).toEqual('1'));
  }, 35000);
});

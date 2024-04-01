describe('JIFF Arithmetic Operations', () => {
  var jiffClients: any[] = [];
  var jiffServer: any;
  var server: any;
  var entries: { [key: number]: number } = { 1: 60, 2: 60 };
  var computation_id = 'test-arithmetics';
  const party_count = 2;

  beforeEach(async () => {
    // Server Setup
    var port: number = 8111;
    const init_server = require('./server');
    const servers = init_server(port);
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
  });

  afterEach(async () => {
    // Shutting down client
    jiffClients.map(async (client, _) => await client.socket.disconnect());

    // Shutting down Server
    await jiffServer.closeAllSockets();
  });

  it('should correctly add 60 + 60 = 120', async () => {
    async function addition(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const input = await jiffClient.share(entries[id]);
            const sec_ttl = await input[1].sadd(input[2]);
            const result = await sec_ttl.open();
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

  it('should correctly subtract numbers 60 - 60 = 0', async () => {
    async function subtraction(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const input = await jiffClient.share(entries[id]);
            const sec_ttl = await input[1].ssub(input[2]);
            const result = await sec_ttl.open();
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => subtraction(client, idx + 1)));
    results.map((res) => expect(res).toEqual('0'));
  });

  it('should correctly multiply numbers 60 x 60 = 3600', async () => {
    async function subtraction(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const input = await jiffClient.share(entries[id]);
            const sec_ttl = await input[1].smult(input[2]);
            const result = await sec_ttl.open();
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => subtraction(client, idx + 1)));
    results.map((res) => expect(res).toEqual('3600'));
  });

  it('should correctly divide numbers 60 / 60', async () => {
    async function subtraction(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const input = await jiffClient.share(entries[id]);
            const sec_ttl = await input[1].sdiv(input[2]);
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
  }, 15000);
});

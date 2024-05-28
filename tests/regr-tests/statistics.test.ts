describe('JIFF Statistics Operations', () => {
  const init_server = require('./server');
  const createClient = require('./common');
  const jiff_s_bignumber = require('../../lib/ext/jiff-server-bignumber.js');
  const jiff_bignumber = require('../../lib/ext/jiff-client-bignumber.js');
  const jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint.js');
  const jiff_negativenumber = require('../../lib/ext/jiff-client-negativenumber.js');

  let jiffClients: any[] = [];
  let jiffServer: any;
  let server: any;
  const entries: { [key: number]: number } = { 1: 60, 2: 60, 3: 60, 4: 60 };
  const computation_id = 'test-stats';
  const party_count = 4;

  beforeEach(async () => {
    // Server Setup
    const port: number = 8114;
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

  async function average(jiffclient: any, input: number) {
    const sshare = await jiffclient.share(input);
    let sec_sum = sshare[1];
    for (let i = 2; i <= jiffclient.party_count; i++) {
      jiffclient.start_barrier();
      sec_sum = await sec_sum.add(sshare[i]);
      jiffclient.end_barrier();
    }
    const result = await sec_sum.open();
    return result.toString(10) / jiffclient.party_count;
  }

  async function standard_deviation(jiffclient: any, input: number) {
    const avg = await average(jiffclient, input);
    const avgOfSquares = await average(jiffclient, input * input);

    const squaredAvg = avg * avg;
    return Math.sqrt(avgOfSquares - squaredAvg);
  }

  it('should correctly compute average of (60, 60, 60, 60) / 4 = 60', async () => {
    async function calc_avg(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2, 3, 4], async () => {
          try {
            const result = await average(jiffClient, entries[id]);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => calc_avg(client, idx + 1)));
    results.map((res) => expect(res).toEqual(60));
  });

  it('should correctly compute standard deviation of (60, 60, 60, 60) = 0', async () => {
    async function calc_std(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2, 3, 4], async () => {
          try {
            const result = standard_deviation(jiffClient, entries[id]);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    const results = await Promise.all(jiffClients.map((client, idx) => calc_std(client, idx + 1)));
    results.map((res) => expect(res).toEqual(0));
  });
});

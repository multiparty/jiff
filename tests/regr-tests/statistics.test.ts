describe('JIFF Statistics Operations', () => {
  var jiffClients: any[] = [];
  var jiffServer: any;
  var server: any;
  const entries: { [key: number]: number } = { 1: 60, 2: 60, 3: 60, 4: 60 };
  var computation_id = 'test-stats';
  const party_count = 4;

  beforeEach(async () => {
    // Server Setup
    var port: number = 8114;
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

  async function average(jiffclient: any, input: number) {
    var sshare = await jiffclient.share(input);
    var sec_sum = sshare[1];
    for (var i = 2; i <= jiffclient.party_count; i++) {
      jiffclient.start_barrier();
      sec_sum = await sec_sum.add(sshare[i]);
      jiffclient.end_barrier();
    }
    var result = await sec_sum.open();
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

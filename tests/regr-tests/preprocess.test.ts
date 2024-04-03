describe('JIFF Preprocessing Operations', () => {
  var jiffClients: any[] = [];
  var jiffServer: any;
  var server: any;
  const entries: { [key: number]: number[] | null[] } = { 1: [1.32, 10.22, 5.67], 2: [5.91, 3.73, 50.03], 3: [null, null, null] };
  var computation_id = 'test-preprocessing';
  const party_count = 3;

  beforeEach(async () => {
    // Server Setup
    var port: number = 8115;
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
    await Promise.all(jiffClients.map(apply_extension))
  });

  afterEach(async () => {
    // Shutting down client
    await Promise.all(jiffClients.map(client => client.socket.disconnect()));

    // Shutting down Server
    await jiffServer.closeAllSockets();
    await jiffServer.freeComputation(computation_id);
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  it('should correctly preprocess inner product of the input array and return 329.59', async () => {
    async function innerprod(jiffClient: any, id: number) {
      await jiffClient.preprocessing('smult', entries[id].length, null, null, null, null, null, null, { div: false });
      await jiffClient.preprocessing('open', 1);
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2, 3], async () => {
          try {
            var sec_ttl: any = 0;
            await jiffClient.executePreprocessing(async function () {
              const input = await jiffClient.share_array(entries[id], null, 3, [1, 2, 3], [1, 2]);
              var array1 = input[1];
              var array2 = input[2];
              sec_ttl = await array1[0].mult(array2[0], null, false);
              for (var i = 1; i < array1.length; i++) {
                sec_ttl = await sec_ttl.add(await array1[i].mult(array2[i], null, false));
              }
              const result = await sec_ttl.open();
              resolve(result.toString(10));
            });
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => innerprod(client, idx + 1)));
    results.map((res) => expect(res).toEqual('329.59'));
  }, 15000);
});

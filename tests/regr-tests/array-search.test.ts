//Inner Product?
describe('JIFF Arithmetic Operations', () => {
  var jiffClients: any[] = [];
  var jiffServer: any;
  var server: any;
  const entries: number[] = [1, 4, 8, 10, 12, 16, 17, 23, 29];
  const input: number = 4;
  const computation_id = 'test-2D-array';
  const party_count = 2;

  beforeEach(async () => {
    // Server Setup
    var port: number = 8113;
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

  it('should check that 4 exists in the input array, using linear search', async () => {
    async function linear_search(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const inputs = id == 1 ? await jiffClient.share_array(entries) : await jiffClient.share_array(input);
            const array = inputs[1];
            const element = inputs[2];

            var occurrences = array[0].seq(element); // check equality for the first element
            for (var i = 1; i < array.length; i++) {
              occurrences = await occurrences.sadd(array[i].seq(element));
            }
            const result = await jiffClient.open(occurrences.cgteq(1)); // check number of occurrences >= 1
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => linear_search(client, idx + 1)));
    results.map((res) => expect(res).toEqual('1'));
  });

  it('should check that 4 exists in the input array, using binary search', async () => {
    async function binary_search(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            const inputs = id == 1 ? await jiffClient.share_array(entries) : await jiffClient.share_array(input);
            const array = inputs[1];
            const element = inputs[2];

            async function _bin_search(array: any[], element: any) {
              if (array.length == 1) {
                return await array[0].seq(element);
              }

              const mid = Math.floor(array.length / 2);
              const cmp = await element.slt(array[mid]);
              var nArray = [];
              for (var i = 0; i < mid; i++) {
                var c1 = array[i];
                var c2 = array[mid + i];
                nArray[i] = await cmp.if_else(c1, c2);
              }
              if (2 * mid < array.length) {
                nArray[mid] = array[2 * mid];
              }
              return await _bin_search(nArray, element);
            }

            const occurrences = await _bin_search(array, element);
            const result = await jiffClient.open(occurrences.cgteq(1)); // check number of occurrences >= 1
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => binary_search(client, idx + 1)));
    results.map((res) => expect(res).toEqual('1'));
  });
});

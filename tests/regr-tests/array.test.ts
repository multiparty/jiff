describe('JIFF Array Operations', () => {
  const init_server = require('./server');
  const JIFFClient = require('../../lib/jiff-client.js');
  
  let jiffClients: any[] = [];
  let jiffServer: any;
  let server: any;
  const entries: number[] = [1, 4, 8, 10, 12, 16, 17, 23, 29];
  const input: number = 4;
  const computation_id = 'test-array';
  const party_count = 2;

  beforeEach(async () => {
    // Server Setup
    let port: number = 8113;
    const servers = init_server(port);
    (jiffServer = servers[0]), (server = servers[1]);
    await new Promise((resolve) => server.on('listening', resolve)); // Wait for server to be ready

    // Client Setup
    const baseUrl = `http://localhost:${port}`;
    const options = {
      party_count: party_count,
      crypto_provider: true
    };

    jiffClients = Array.from({ length: party_count }, () => new JIFFClient(baseUrl, computation_id, options));
  });

  afterEach(async () => {
    // Shutting down client
    await Promise.all(jiffClients.map((client) => client.socket.disconnect()));

    // Shutting down Server
    await jiffServer.closeAllSockets();
    await jiffServer.freeComputation(computation_id);
  });

  it('should check that 2D Array works with simple arithmetics', async () => {
    const arrays: number[][] = [
      [1, 2, 3, 4],
      [4, 3, 2, 1]
    ];
    async function array_arithmetics(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            let array = await jiffClient.share_array(arrays[id]);
            let result = await array[1];
            for (let party = 2; party <= jiffClient.party_count; party++) {
              for (let idx = 0; idx < result.length; idx++) {
                result[idx] = await result[idx].add(await array[party][idx]);
              }
            }
            result = await jiffClient.open_array(result);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => array_arithmetics(client, idx)));
    results.map((res) => expect(res).toEqual([5, 5, 5, 5]));
  });

  it('should check that 4 exists in the input array, using linear search', async () => {
    async function linear_search(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            let arrayToShare = null;
            if (id == 1) {
              arrayToShare = entries;
            } else {
              arrayToShare = input;
            }
            const inputs = await jiffClient.share_array(arrayToShare);
            const array = await inputs[1];
            const element = await inputs[2];

            let occurrences = await array[0].eq(element);
            for (let i = 1; i < array.length; i++) {
              const check = await array[i].eq(element);
              occurrences = await occurrences.add(check);
            }
            let result = await occurrences.gteq(1);
            result = await jiffClient.open(result);
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => linear_search(client, idx + 1)));
    results.map((res) => expect(res).toEqual('1'));
  }, 20000);

  it('should check that 4 exists in the input array, using binary search', async () => {
    async function binary_search(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2], async () => {
          try {
            let whichArray = null;
            if (id == 1) {
              whichArray = entries;
            } else {
              whichArray = input;
            }
            const inputs = await jiffClient.share_array(whichArray);
            const array = await inputs[1];
            const elem = await inputs[2];

            async function _bin_search(array: any[], element: any) {
              if (array.length == 1) {
                return await array[0].eq(element);
              }

              const mid = Math.floor(array.length / 2);
              const cmp = await element.lt(await array[mid]);
              let nArray = [];
              for (let i = 0; i < mid; i++) {
                const c1 = array[i];
                const c2 = array[mid + i];
                nArray[i] = await cmp.if_else(c1, c2);
              }
              if (2 * mid < array.length) {
                nArray[mid] = array[2 * mid];
              }
              return await _bin_search(nArray, element);
            }

            const occurrences = await _bin_search(array, elem);
            let result = await occurrences.gteq(1);
            result = await jiffClient.open(result);
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

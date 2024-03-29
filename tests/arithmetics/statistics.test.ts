function init_server(port: number) {
  const express = require('express');
  const app = express();
  const server = require('http').Server(app);

  app.use('../../dist', express.static('../../dist'));
  app.use('../../lib/ext', express.static('../../lib/ext'));
  app.use('/', express.static('../../lib/client'));

  server.listen(port, function () {
    console.log('Listening on ', port);
  });

  const JIFFServer = require('../../lib/jiff-server.js');
  const jiffServer = new JIFFServer(server, { logs: true });

  console.log('server is running on port', port);
  return [jiffServer, server];
}

describe('JIFF Statistics Operations', () => {
  let jiffClient1: any;
  let jiffClient2: any;
  let jiffClient3: any;
  let jiffClient4: any;
  let jiffServer: any;
  let server: any;
  var entries: { [key: number]: number } = { 1: 60, 2: 60, 3: 60, 4: 60 };
  let computation_id = 'our-setup-application';

  beforeEach(async () => {
    // Server Setup
    let port: number = 8112;
    const servers = init_server(port);
    (jiffServer = servers[0]), (server = servers[1]);
    await new Promise((resolve) => server.on('listening', resolve)); // Wait for server to be ready

    // Client Setup
    const JIFFClient = require('../../lib/jiff-client.js');
    const baseUrl = `http://localhost:${port}`;
    const options = {
      party_count: 4,
      crypto_provider: true
    };

    jiffClient1 = new JIFFClient(baseUrl, computation_id, options);
    jiffClient2 = new JIFFClient(baseUrl, computation_id, options);
    jiffClient3 = new JIFFClient(baseUrl, computation_id, options);
    jiffClient4 = new JIFFClient(baseUrl, computation_id, options);

    const jiff_bignumber = require('../../lib/ext/jiff-client-bignumber.js');
    const jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint.js');
    const jiff_negativenumber = require('../../lib/ext/jiff-client-negativenumber.js');

    function apply_extension(jiff: any) {
      jiff.apply_extension(jiff_bignumber, options);
      jiff.apply_extension(jiff_fixedpoint, options);
      jiff.apply_extension(jiff_negativenumber, options);
    }
    apply_extension(jiffClient1);
    apply_extension(jiffClient2);
    apply_extension(jiffClient3);
    apply_extension(jiffClient4);
  });

  afterEach(async () => {
    // Shutting down client
    await jiffClient1.socket.disconnect();
    await jiffClient2.socket.disconnect();
    await jiffClient3.socket.disconnect();
    await jiffClient4.socket.disconnect();

    // Shutting down Server
    await jiffServer.closeAllSockets();
  });

  async function average(jiffclient: any, input: number) {
    var sshare = await jiffclient.share(input);
    var sec_sum = sshare[1];
    for (var i = 2; i <= jiffclient.party_count; i++) {
      sec_sum = await sec_sum.sadd(sshare[i]);
    }
    var result = await sec_sum.open();
    return result.toString(10) / jiffclient.party_count;
  }

  it('should correctly compute average of (60, 60, 60, 60) / 4 = 60', async () => {
    const client1Promise = new Promise((resolve, reject) => {
      jiffClient1.wait_for([1, 2, 3, 4], async () => {
        try {
          const result = average(jiffClient1, entries[1]);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    const client2Promise = new Promise((resolve, reject) => {
      jiffClient2.wait_for([1, 2, 3, 4], async () => {
        try {
          const result = average(jiffClient2, entries[2]);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    const client3Promise = new Promise((resolve, reject) => {
      jiffClient3.wait_for([1, 2, 3, 4], async () => {
        try {
          const result = average(jiffClient3, entries[3]);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    const client4Promise = new Promise((resolve, reject) => {
      jiffClient4.wait_for([1, 2, 3, 4], async () => {
        try {
          const result = average(jiffClient4, entries[4]);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    const results = await Promise.all([client1Promise, client2Promise, client3Promise, client4Promise]);
    expect(results[0]).toEqual(60);
    expect(results[1]).toEqual(60);
    expect(results[2]).toEqual(60);
    expect(results[3]).toEqual(60);
  });

  it('should correctly compute standard deviation of (60, 60, 60, 60) = 0', async () => {
    async function standard_deviation(jiffclient: any, input: number) {
      const avg = await average(jiffclient, input);
      const avgOfSquares = await average(jiffclient, input * input);

      const squaredAvg = (await avg) * avg;
      return Math.sqrt(avgOfSquares - squaredAvg);
    }

    const client1Promise = new Promise((resolve, reject) => {
      jiffClient1.wait_for([1, 2, 3, 4], async () => {
        try {
          const result = standard_deviation(jiffClient1, entries[1]);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    const client2Promise = new Promise((resolve, reject) => {
      jiffClient2.wait_for([1, 2, 3, 4], async () => {
        try {
          const result = standard_deviation(jiffClient2, entries[2]);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    const client3Promise = new Promise((resolve, reject) => {
      jiffClient3.wait_for([1, 2, 3, 4], async () => {
        try {
          const result = standard_deviation(jiffClient3, entries[3]);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    const client4Promise = new Promise((resolve, reject) => {
      jiffClient4.wait_for([1, 2, 3, 4], async () => {
        try {
          const result = standard_deviation(jiffClient4, entries[4]);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    const results = await Promise.all([client1Promise, client2Promise, client3Promise, client4Promise]);
    expect(results[0]).toEqual(0);
    expect(results[1]).toEqual(0);
    expect(results[2]).toEqual(0);
    expect(results[3]).toEqual(0);
  });
});

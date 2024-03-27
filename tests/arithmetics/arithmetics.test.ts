function init_server(port:number){

  const express = require("express");
  const app = express();
  const server = require("http").Server(app);

  app.use("../../dist", express.static("../../dist"));
  app.use("../../lib/ext", express.static("../../lib/ext"));
  app.use("/", express.static("/client"));

  server.listen(port, function () {
    console.log("Listening on ", port);
  });

  const JIFFServer = require("../../lib/jiff-server.js");
  const jiffServer = new JIFFServer(server, { logs: true });

  console.log("server is running on port", port);
  return server
}


describe('JIFF Arithmetic Operations', () => {
  let jiffClient1:any;
  let jiffClient2:any;
  let server:any;
  var entries: {[key:number]:number} = { 1: 60, 2: 60 };
  let port:number = 8112

  const options = {
    party_count: 2,
    crypto_provider: true,
  };

  beforeEach(async () => {
    server = init_server(port)
    await new Promise(resolve => server.on('listening', resolve)); // Wait for server to be ready

    const JIFFClient = require("../../lib/jiff-client.js");
    const serverAddress = server.address();
    const baseUrl = `http://localhost:${serverAddress.port}`;

    jiffClient1 = new JIFFClient(baseUrl, "our-setup-application", options);
    jiffClient2 = new JIFFClient(baseUrl, "our-setup-application", options);
    port += 1
  });

  afterEach(async () => {
    await new Promise((resolve, reject) => {
      server.close((err:any) => {
          if (err) {
              console.error('Error closing server:', err);
              reject(err);
              return;
          }
          resolve(console.log('Server closed'));
      });
    });
  });

  it('should correctly add 60 + 60 = 120', async () => {

    const client1Promise = new Promise((resolve, reject) => {
        jiffClient1.wait_for([1, 2], async () => {
            try {
                const input1 = await jiffClient1.share(entries[1]);
                const sec_ttl1 = await input1[1].sadd(input1[2]);
                const result = await sec_ttl1.open();
                resolve(result.toString(10));
            } catch (error) {
                reject(error);
            }
        });
    });

    const client2Promise = new Promise((resolve, reject) => {
        jiffClient2.wait_for([1, 2], async () => {
            try {
                const input2 = await jiffClient2.share(entries[2]);
                const sec_ttl2 = await input2[1].sadd(input2[2]);
                const result = await sec_ttl2.open();
                resolve(result.toString(10));
            } catch (error) {
                reject(error);
            }
        });
    });

    const results = await Promise.all([client1Promise, client2Promise]);
    
    expect(results[0]).toEqual('120');
    expect(results[1]).toEqual('120');
});


  it('should correctly subtract numbers 60 - 60 = 0', async () => {
    entries = { 1: 60, 2: 60 };

    const client1Promise = new Promise((resolve, reject) => {
        jiffClient1.wait_for([1, 2], async () => {
            try {
                const input1 = await jiffClient1.share(entries[1]);
                const sec_ttl1 = await input1[1].ssub(input1[2]);
                const result = await sec_ttl1.open();
                resolve(result.toString(10));
            } catch (error) {
                reject(error);
            }
        });
    });

    const client2Promise = new Promise((resolve, reject) => {
        jiffClient2.wait_for([1, 2], async () => {
            try {
                const input2 = await jiffClient2.share(entries[2]);
                const sec_ttl2 = await input2[1].ssub(input2[2]);
                const result = await sec_ttl2.open();
                resolve(result.toString(10));
            } catch (error) {
                reject(error);
            }
        });
    });
    const results = await Promise.all([client1Promise, client2Promise]);
    
    expect(results[0]).toEqual('0');
    expect(results[1]).toEqual('0');
  });


  it('should correctly multiply numbers 60 x 60 = 3600', async () => {
    entries = { 1: 60, 2: 60 };

    const client1Promise = new Promise((resolve, reject) => {
        jiffClient1.wait_for([1, 2], async () => {
            try {
                const input1 = await jiffClient1.share(entries[1]);
                const sec_ttl1 = await input1[1].smult(input1[2]);
                const result = await sec_ttl1.open();
                resolve(result.toString(10));
            } catch (error) {
                reject(error);
            }
        });
    });

    const client2Promise = new Promise((resolve, reject) => {
        jiffClient2.wait_for([1, 2], async () => {
            try {
                const input2 = await jiffClient2.share(entries[2]);
                const sec_ttl2 = await input2[1].smult(input2[2]);
                const result = await sec_ttl2.open();
                resolve(result.toString(10));
            } catch (error) {
                reject(error);
            }
        });
    });
    const results = await Promise.all([client1Promise, client2Promise]);
    
    expect(results[0]).toEqual('3600');
    expect(results[1]).toEqual('3600');
  });


  it('should correctly divide numbers 60 / 60', async () => {
    entries = { 1: 60, 2: 60 };

    const client1Promise = new Promise((resolve, reject) => {
        jiffClient1.wait_for([1, 2], async () => {
            try {
                const input1 = await jiffClient1.share(entries[1]);
                const sec_ttl1 = await input1[1].sdiv(input1[2]);
                const result = await sec_ttl1.open();
                resolve(result.toString(10));
            } catch (error) {
                reject(error);
            }
        });
    });

    const client2Promise = new Promise((resolve, reject) => {
        jiffClient2.wait_for([1, 2], async () => {
            try {
                const input2 = await jiffClient2.share(entries[2]);
                const sec_ttl2 = await input2[1].sdiv(input2[2]);
                const result = await sec_ttl2.open();
                resolve(result.toString(10));
            } catch (error) {
                reject(error);
            }
        });
    });
    const results = await Promise.all([client1Promise, client2Promise]);
    
    expect(results[0]).toEqual('1');
    expect(results[1]).toEqual('1');
  });
});

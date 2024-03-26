describe('JIFF Operations', () => {
  
  // Setup JIFF Client
  const JIFFClient = require("../../lib/jiff-client.js");

  const options = {
    party_count: 2,
    crypto_provider: true,
  };
  
  var jiffClient = new JIFFClient(
    "http://localhost:8112",
    "our-setup-application",
    options,
  );

  var entries: {[key:number]:number};
    
  beforeAll(async () => {
    
    entries = { 1: 60, 2: 60 };
  });

  it('should correctly add numbers 60 + 60 = 120', (done: jest.DoneCallback) => { // Using the 'done' callback
    new Promise<void>(async (resolve, reject) => {
      jiffClient.wait_for([1, 2], async () => {
        try {
          const input = await jiffClient.share(entries[1]);
          const sec_ttl = await input[1].sadd(input[2]);
          sec_ttl.open().then((pub_result:number) => {
            try {
              // Convert result to string and compare
              const result = pub_result.toString(10);
              expect(result).toEqual('120');
              resolve(); // Resolve the promise if the test passes
            } catch (error) {
              reject(error); // Reject the promise if the assertion fails
            }
          }).catch(reject); // Reject the promise if sec_ttl.open() throws an error
        } catch (error) {
          reject(error); // Reject the promise if an error occurs
        }
      });
    }).then(() => done()).catch(done);
  });

  it('should correctly subtract numbers 60 - 60 = 0', (done: jest.DoneCallback) => { // Using the 'done' callback
    new Promise<void>(async (resolve, reject) => {
      jiffClient.wait_for([1, 2], async () => {
        try {
          const input = await jiffClient.share(entries[1]);
          const sec_ttl = await input[1].ssub(input[2]);
          sec_ttl.open().then((pub_result:number) => {
            try {
              // Convert result to string and compare
              const result = pub_result.toString(10);
              expect(result).toEqual('0');
              resolve(); // Resolve the promise if the test passes
            } catch (error) {
              reject(error); // Reject the promise if the assertion fails
            }
          }).catch(reject); // Reject the promise if sec_ttl.open() throws an error
        } catch (error) {
          reject(error); // Reject the promise if an error occurs
        }
      });
    }).then(() => done()).catch(done);
  });


  it('should correctly multiply numbers 60 x 60 =3600', (done: jest.DoneCallback) => { // Using the 'done' callback
    new Promise<void>(async (resolve, reject) => {
      jiffClient.wait_for([1, 2], async () => {
        try {
          const input = await jiffClient.share(entries[1]);
          const sec_ttl = await input[1].smult(input[2]);
          sec_ttl.open().then((pub_result:number) => {
            try {
              // Convert result to string and compare
              const result = pub_result.toString(10);
              expect(result).toEqual('3600');
              resolve(); // Resolve the promise if the test passes
            } catch (error) {
              reject(error); // Reject the promise if the assertion fails
            }
          }).catch(reject); // Reject the promise if sec_ttl.open() throws an error
        } catch (error) {
          reject(error); // Reject the promise if an error occurs
        }
      });
    }).then(() => done()).catch(done);
  });

  it('should correctly divide numbers 60 / 60', (done: jest.DoneCallback) => { // Using the 'done' callback
    new Promise<void>(async (resolve, reject) => {
      jiffClient.wait_for([1, 2], async () => {
        try {
          const input = await jiffClient.share(entries[1]);
          const sec_ttl = await input[1].sdiv(input[2]);
          sec_ttl.open().then((pub_result:number) => {
            try {
              // Convert result to string and compare
              const result = pub_result.toString(10);
              expect(result).toEqual('1');
              resolve(); // Resolve the promise if the test passes
            } catch (error) {
              reject(error); // Reject the promise if the assertion fails
            }
          }).catch(reject); // Reject the promise if sec_ttl.open() throws an error
        } catch (error) {
          reject(error); // Reject the promise if an error occurs
        }
      });
    }).then(() => done()).catch(done);
  });
});

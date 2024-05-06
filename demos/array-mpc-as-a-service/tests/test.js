// eslint-disable-next-line no-undef
describe('MPC-as-a-service (Array Version)', function () {
  this.timeout(0);

  // eslint-disable-next-line no-undef
  it(process.env.TEST_CONFIG, function (done) {
    const config = require('./../' + process.env.TEST_CONFIG);
    const clientMPC = require('./../client-mpc.js');

    // read config
    const compute_parties = config.compute_parties;
    const input_parties_count = config.input_parties.length;

    // run a bunch of compute parties
    const output = [-1, -1];
    const promises = [];
    for (let i = 0; i < input_parties_count; i++) {
      const jiffClient = clientMPC.connect('http://localhost:8080/', 'test', {}, config);

      // generate input
      const input = Array(config.input_length).fill(0).map(() => Math.floor(Math.random() * jiffClient.Zp));

      // sum output
      output[0] = (output[0] + input.reduce((a,b) => a+b)) % jiffClient.Zp;

      // dot product output
      output[1] = output[1] === -1 ? input : (
        (output[1].map((e, i) => [e, input[i]]).map(e => e.reduce((a,b) => a*b))).reduce((a,b) => a+b)
      ) % jiffClient.Zp;

      // compute
      promises.push(new Promise(function (jiffClient, input, i, resolve) {
        jiffClient.wait_for(compute_parties, function (jiffClient) {
          const promise = clientMPC.compute(input, jiffClient);
          // randomly disconnect some input parties right after they submit their shares
          if (i > 0 && Math.random() < 0.5) {
            jiffClient.disconnect(true, true);
            resolve('disconnected');
          } else {
            promise.then(resolve);
          }
        });
      }.bind(null, jiffClient, input, i)));
    }

    // verify output
    Promise.all(promises).then(function (results) {
      for (let i = 0; i < results.length; i++) {
        if (results[i][0] !== output[0] && results[i][1] !== output[1] && results[i] !== 'disconnected') {
          done(new Error('Expected output ' + output + ', found ' + results[i]));
        }
      }
      done();
    });
  });
});

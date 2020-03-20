// eslint-disable-next-line no-undef
describe('MPC-as-a-service', function () {
  this.timeout(0);

  // eslint-disable-next-line no-undef
  it(process.env.TEST_CONFIG, function (done) {
    var config = require('./../' + process.env.TEST_CONFIG);
    var clientMPC = require('./../client-mpc.js');

    // read config
    var compute_parties = config.compute_parties;
    var input_parties_count = config.input_parties.length;

    // run a bunch of compute parties
    var output = 0;
    var promises = [];
    for (var i = 0; i < input_parties_count; i++) {
      var jiffClient = clientMPC.connect('http://localhost:8080/', 'test', {}, config);

      // generate input
      var input = Math.floor(Math.random() * jiffClient.Zp);
      output = (output + input) % jiffClient.Zp;
      promises.push(new Promise(function (jiffClient, input, i, resolve) {
        jiffClient.wait_for(compute_parties, function (jiffClient) {
          var promise = clientMPC.compute(input, jiffClient);
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
      for (var i = 0; i < results.length; i++) {
        if (results[i] !== output && results[i] !== 'disconnected') {
          done(new Error('Expected output ' + output + ', found ' + results[i]));
        }
      }
      done();
    });
  });
});
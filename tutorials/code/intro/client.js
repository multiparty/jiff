var JIFFClient = require('../../../lib/jiff-client');
var options = {party_count: 3, crypto_provider: true};

try {
  var input = JSON.parse(process.argv[2]);
  if (input.length !== 4) {
    console.log('Input should be a JSON of length 4, with no spaces (e.g. [0,1,0,0])');
    process.exit(1);
  }
} catch (e) {
  console.log('Input should be a JSON of length 4, with no spaces (e.g. [0,1,0,0])');
  process.exit();
}

options.onConnect = function (jiff_instance) {
  var options = ['IPA', 'Lager', 'Stout', 'Pilsner'];

  jiff_instance.wait_for([1, 2, 3], function () {
    var results = [];
    for (var i = 0; i < options.length; i++) {
      var ithOptionShares = jiff_instance.share(input[i]);
      var ithOptionResult = ithOptionShares[1].sadd(ithOptionShares[2]).sadd(ithOptionShares[3]);
      results.push(jiff_instance.open(ithOptionResult));
    }

    Promise.all(results).then(function (results) {
      console.log('options', options);
      console.log('results', results);
      jiff_instance.disconnect();
    });
  });
};

new JIFFClient('http://localhost:9111', 'voting-tutorial', options);

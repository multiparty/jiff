/**
 * This is a server instance, it just routes communication
 * between different parties.
 * To run, use:
 *  node server.js [path/to/configuration/file]
 * Configuration file path is optional, by default ./config.js
 * will be used.
 */
console.log('Command line arguments: [/path/to/configuration/file.json]');

// Server setup
var express = require('express');
var app = express();
var http = require('http').Server(app);
var path = require('path');

// body parser to handle json data
var bodyParser  = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Read configuration
var config = './config.json';
if (process.argv[2] != null) {
  config = './' + process.argv[2];
}

console.log('Using config file: ', path.join(__dirname, config));
config = require(config);

// Keep track of assigned ids
var assignedCompute = {};
var assignedInput = {};
var options = {
  logs: true,
  hooks: {
    beforeInitialization: [
      function (jiff, computation_id, msg, params) {
        console.log('got called with', msg.role);
        if (params.party_id != null) {
          return params;
        }

        var search = config.compute_parties;
        var check = assignedCompute;
        if (msg.role === 'input') {
          search = config.input_parties;
          check = assignedInput;
        }

        for (var p = 0; p < search.length; p++) {
          var id = search[p];
          if (check[id] === true || id === 's1') {
            continue;
          }

          check[id] = true;
          params.party_id = id;
          return params;
        }

        return params;
      }
    ]
  }
};

// Create the server
var JIFFServer = require('../../lib/jiff-server');
var jiffRestAPIServer = require('../../lib/ext/jiff-server-restful.js');
var jiffServer = new JIFFServer(http, options);
var computeOptions = {
  crypto_provider: config.preprocessing === false, // comment this out if you want to use preprocessing
  party_count: 5,
  initialization: {role: 'compute'} // indicate to the server that this is a compute party
}
jiffServer.computationMaps.maxCount['test'] = config.party_count;
var jiffClient = jiffServer.compute('test', computeOptions);
jiffServer.apply_extension(jiffRestAPIServer, {app: app});

// Serve static files.
app.get('/config.js', function (req, res) {
  var str = 'var config = \'' + JSON.stringify(config) + '\';\n';
  str += 'config = JSON.parse(config);';
  res.send(str);
});

app.use('/demos', express.static(path.join(__dirname, '..', '..', 'demos')));
app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));
app.use('/lib/ext', express.static(path.join(__dirname, '..', '..', 'lib', 'ext')));
http.listen(8080, function () {
  console.log('listening on *:8080');
});

var all_parties = config.compute_parties.concat(config.input_parties);
var compute = function () {
  jiffClient.wait_for(all_parties, function () {
    // We are a compute party, we do not have any input (thus secret is null),
    // we will receive shares of inputs from all the input_parties.
    var shares = jiffClient.share(null, null, config.compute_parties, config.input_parties);

    var sum = shares[config.input_parties[0]];
    for (var i = 1; i < config.input_parties.length; i++) {
      var p = config.input_parties[i];
      sum = sum.sadd(shares[p]);
    }

    jiffClient.open(sum, all_parties).then(function (output) {
      console.log('Final output is: ', output);
      jiffClient.disconnect(true, true);
    });
  });
};

// wait only for the compute parties to preprocess
jiffClient.wait_for(config.compute_parties, function () {
  if (config.preprocessing !== false) {
    // do not use crypto provider, perform preprocessing!
    jiffClient.preprocessing('open', 1, null, null, config.compute_parties, config.compute_parties, null, null, {open_parties: all_parties});
    jiffClient.executePreprocessing(compute.bind(null, jiffClient));
  } else {
    // no preprocessing: use server as crypto provider

    compute();
  }
});

console.log('** To provide inputs, direct your browser to http://localhost:8080/demos/mpc-as-a-service/client.html.');
console.log('** To run a compute party, use the command line and run node compute-party.js [configuration-file] [computation-id]');
console.log('All compute parties must be running before input parties can connect, an input party can leave');
console.log('any time after it submits its input.');
console.log('');

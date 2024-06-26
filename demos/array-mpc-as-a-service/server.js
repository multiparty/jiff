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
const express = require('express');
const app = express();
const http = require('http').Server(app);
const path = require('path');

// body parser to handle json data
const bodyParser  = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Read configuration
let config = './config.json';
if (process.argv[2] != null) {
  config = './' + process.argv[2];
}

console.log('Using config file: ', path.join(__dirname, config));
config = require(config);

// Keep track of assigned ids
const assignedCompute = {};
const assignedInput = {};
const options = {
  logs: true,
  hooks: {
    beforeInitialization: [
      function (jiff, computation_id, msg, params) {
        console.log('got called with', msg.role);
        if (params.party_id != null) {
          return params;
        }

        let search = config.compute_parties;
        let check = assignedCompute;
        if (msg.role === 'input') {
          search = config.input_parties;
          check = assignedInput;
        }

        for (let p = 0; p < search.length; p++) {
          const id = search[p];
          if (check[id] === true) {
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
const JIFFServer = require('../../lib/jiff-server');
const jiffRestAPIServer = require('../../lib/ext/jiff-server-restful.js');
const jiffServer = new JIFFServer(http, options);
jiffServer.apply_extension(jiffRestAPIServer, {app: app});

// Serve static files.
app.get('/config.js', function (req, res) {
  let str = 'var config = \'' + JSON.stringify(config) + '\';\n';
  str += 'config = JSON.parse(config);';
  res.send(str);
});

app.use('/demos', express.static(path.join(__dirname, '..', '..', 'demos')));
app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));
app.use('/lib/ext', express.static(path.join(__dirname, '..', '..', 'lib', 'ext')));
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('** To provide inputs, direct your browser to http://localhost:8080/demos/array-mpc-as-a-service/client.html.');
console.log('** To run a compute party, use the command line and run node compute-party.js [configuration-file] [computation-id]');
console.log('All compute parties must be running before input parties can connect, an input party can leave');
console.log('any time after it submits its input.');
console.log('');
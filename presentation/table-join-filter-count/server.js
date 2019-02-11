var express = require('express');
var app = express();

var http = require('http').Server(app);
http.listen(8080, function () {
  console.log('listening on *:8080');
});

// nunjucks for rendering html template
var nunjucks = require('nunjucks');
nunjucks.configure(__dirname, {
  autoescape: true,
  express: app
});

// read configurations
var config = require('./config.json');

//Serve static files
app.use('/lib', express.static(__dirname + '/../../lib'));

// Server input and analyst files
app.use('/static/input', express.static(__dirname + '/input'));
app.use('/static/analyst', express.static(__dirname + '/analyst'));
app.get('/input/:id', function (req, res) {
  var party_id = parseInt(req.params.id, 10);
  res.render('input/input.html', {id: party_id + config.compute + 1, config: config});
});
app.get('/analyst', function (req, res) {
  res.render('analyst/analyst.html', {id: config.compute + 1, config: config});
});

// Manage roles / IDS
// Keep track of assigned ids
var assignedCompute = 1;
var initialize = function (jiff, computation_id, msg, params) {
  if (params.party_id != null) {
    return params;
  }

  if (msg.role === 'input') {
    return params;
  }
  if (msg.role === 'analyst') {
    params['party_id'] = config.compute + 1;
    return params;
  }
  if (msg.role === 'compute' && assignedCompute <= config.compute) {
    params['party_id'] = assignedCompute;
    assignedCompute++;
    return params;
  }

  throw new Error('Unrecognized role and party id options');
};

require('../../lib/jiff-server').make_jiff(http, {logs: true, hooks: { beforeInitialization: [initialize] }});


// Instructions
console.log('Direct your browser to http://localhost/input/<party-id> for inputing data');
console.log('Direct your browser to http://localhost/analyst for analyst UI');
console.log('Run compute parties with node compute/party.js');
console.log();
/**
 * Do not change this unless you have to.
 * This code parses input command line arguments,
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */
var mpc = require('./mpc');
var config = require('../config.json');

// JIFF options
var options = {
  onConnect: mpc.compute,
  initialization: {role: 'compute'},
  party_count: config.total
};

// Connect
mpc.connect('http://localhost:8080', config.computation_id, options);

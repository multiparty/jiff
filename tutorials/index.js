const express = require('express');
const Neptune = require('neptune-notebook');

const jsDependencies = [
  __dirname + '/../dist/jiff-client.js',
  __dirname + '/../node_modules/bignumber.js/bignumber.min.js',
  __dirname + '/../lib/ext/jiff-client-bignumber.js',
  __dirname + '/../lib/ext/jiff-client-fixedpoint.js',
  __dirname + '/../lib/ext/jiff-client-negativenumber.js'
];

const plotly = ['static/js/plotly-latest.min.js'];

const neptune = new Neptune();
neptune.addDocument('MPC', '0-intro-to-mpc.md', true, jsDependencies.concat(plotly));
neptune.addDocument('intro', '1-intro.md', true, jsDependencies);
neptune.addDocument('voting', '2-voting.md', true, jsDependencies);
neptune.addDocument('binary-search', '3-binarysearch.md', true, jsDependencies);
neptune.addDocument('standard-deviation', '4-standarddev.md', true, jsDependencies);
neptune.addDocument('inner-product', '5-innerprod.md', true, jsDependencies);
neptune.addDocument('preprocessing', '6-preprocessing.md', true, jsDependencies);
neptune.addDocument('parallel', '7-parallel.md', true, jsDependencies);

/*
neptune.writeHTML('MPC', 'demo/html/tutorial/0.html');
neptune.writeHTML('intro', 'demo/html/tutorial/1.html');
neptune.writeHTML('voting', 'demo/html/tutorial/2.html');
neptune.writeHTML('binary-search', 'demo/html/tutorial/3.html');
neptune.writeHTML('standard-deviation', 'demo/html/tutorial/4.html');
neptune.writeHTML('inner-product', 'demo/html/tutorial/5.html');
neptune.writeHTML('preprocessing', 'demo/html/tutorial/6.html');
neptune.writeHTML('parallel', 'demo/html/tutorial/7.html');
*/

neptune.start(9111);

global.neptune = neptune;
global.app = neptune.app;
global.server = neptune.server;

/* global app */
app.use('/static', express.static('static/'));
app.use('/lib', express.static('../lib/'));
app.use('/dist', express.static('../dist/'));

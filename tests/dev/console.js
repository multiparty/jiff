var jiff = require('../../lib/jiff-client');
var jiffBigNumber = require('../../lib/ext/jiff-client-bignumber');
var jiffFixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
var jiffNegativeNumber = require('../../lib/ext/jiff-client-negativenumber');
var jiffPerformance = require('../../lib/ext/jiff-client-performance');

var jiffServer = require('../../lib/jiff-server');
var jiffServerBigNumber = require('../../lib/ext/jiff-server-bignumber');

var extensions = [];
var serverExtensions = [];

var port = 3000;
var computation_id = 'test';
var party_count = 3;

exports.help = function () {
  var msg = '1) call extend(useBigNumber, useFixedpoint, useNegativeNumber, usePerformance)';
  msg += '\n\tAll parameters are boolean';
  msg += '\n\n2) call init(serverPort, serverOptions);';
  msg += '\n\tAll parameters are optional';
  msg += '\n\tReturns the jiff server instance';
  msg += '\n\n3) call create(computation_id, party_count, clientOptions)';
  msg += '\n\tAll parameters are optional';
  msg += '\n\tReturns an array of jiff-instance, one per party';

  console.log(msg);
};

exports.extend = function (big, fixed, negative, perf) {
  if (big) {
    extensions.push(jiffBigNumber);
    serverExtensions.push(jiffServerBigNumber);
  }

  if (fixed) {
    extensions.push(jiffFixedpoint);
  }

  if (negative) {
    extensions.push(jiffNegativeNumber);
  }

  if (perf) {
    extensions.push(jiffPerformance);
  }
};

exports.init = function (p, serverOptions) {
  if (p != null) {
    port = p;
  }

  var express = require('express');
  var app = express();
  var http = require('http').Server(app);

  var instance = new jiffServer(http, serverOptions);
  for (var i = 0; i < serverExtensions.length; i++) {
    instance.apply_extension(serverExtensions[i], serverOptions);
  }

  http.listen(port, function () {
    console.log('listening on *:' + port);
  });
  return instance;
};

exports.create = function (id, c, options) {
  if (id != null) {
    computation_id = id;
  }
  if (c != null) {
    party_count = c;
  }
  if (options == null) {
    options = {
      onConnect: function (j) {
        console.log('Connected ', j.id);
      }
    };
  }

  options.party_count = party_count;

  var result = [];
  for (var p = 0; p < c; p++) {
    result[p] = new jiff('http://localhost:' + port, computation_id, options);
    for (var i = 0; i < extensions.length; i++) {
      result[p].apply_extension(extensions[i], options);
    }
  }

  return result;
};

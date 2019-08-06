global.crypto = require('crypto');
var client_asyncshare = require('./jiff-client-asynchronousshare.js');

exports.name = 'asyncshare';
exports.make_jiff = function (base_instance, options) {
  var jiff = base_instance;

  initialize_hooks(jiff, options);

  jiff.helpers.get_party_number = function (party_id, share_num, party_count) {
    if (share_num == null) {
      share_num = 0;
    }
    if (typeof(party_id) === 'number') {
      return party_id + (share_num * (party_count+1));
    }
    if (party_id.startsWith('s')) {
      return parseInt(party_id.substring(1), 10) * (party_count+1); // n+1 reserved for server
    }
    return parseInt(party_id, 10) + (share_num * (party_count+1));
  };


  // Helpers for creating triplets/numbers and sharing them.
  jiff.request_triplet_share = function (msg, computation_id, from_id) {
    // parse message
    var triplet_id = msg.triplet_id;
    var receivers = msg.receivers;
    var threshold = msg.threshold;
    var Zp = msg.Zp;
    var ratios = msg.ratios;

    jiff.hooks.log(jiff, 'triplet ' + triplet_id + ' from ' + computation_id + '-' + from_id + ':: ' + JSON.stringify(msg));

    if (jiff.triplets_map[computation_id] == null) {
      jiff.triplets_map[computation_id] = {};
    }

    var all_triplets = jiff.triplets_map[computation_id];

    if (all_triplets[triplet_id] == null) { // Generate Triplet.
      var triplet = jiff.hooks.generateTriplet(jiff, computation_id, Zp);
      var a = triplet.a;
      var b = triplet.b;
      var c = triplet.c;

      var a_shares = jiff.hooks.computeShares(jiff, a, receivers, threshold, Zp, ratios);
      var b_shares = jiff.hooks.computeShares(jiff, b, receivers, threshold, Zp, ratios);
      var c_shares = jiff.hooks.computeShares(jiff, c, receivers, threshold, Zp, ratios);

      var triplet_shares = {};
      for (var i = 0; i < receivers.length; i++) {
        var pid = receivers[i];
        a = a_shares[pid];
        b = b_shares[pid];
        c = c_shares[pid];

        triplet_shares[pid] = {a: a, b: b, c: c};
      }

      all_triplets[triplet_id] = triplet_shares;
    }

    return {triplet: all_triplets[triplet_id][from_id], triplet_id: triplet_id};
  };

  jiff.request_number_share = function (msg, computation_id, from_id) {
    // parse message/request
    var base_number_id = msg.number_id;
    var receivers = msg.receivers;
    var threshold = msg.threshold;
    var Zp = msg.Zp;
    var count = msg.count;
    var ratios = msg.__args[0];

    if (count == null) {
      count = 1;
    }

    jiff.hooks.log(jiff, 'number ' + base_number_id + ' from ' + computation_id + '-' + from_id + ':: ' + JSON.stringify(msg));

    if (jiff.numbers_map[computation_id] == null) {
      jiff.numbers_map[computation_id] = {};
    }

    var result = [];
    var all_numbers = jiff.numbers_map[computation_id];
    for (var i = 0; i < count; i++) {
      var number_id = base_number_id + ':' + i;
      if (all_numbers[number_id] == null) { // Generate shares for number.
        var number = jiff.hooks.generateNumber(jiff, computation_id, msg);
        all_numbers[number_id] = jiff.hooks.computeShares(jiff, number, receivers, threshold, Zp, ratios);
      }
      result.push({number_id: number_id, number: all_numbers[number_id][from_id]});
    }

    return result;
  };

  return jiff;
};

function initialize_hooks(jiff, options) {
  if (options.hooks == null) {
    options.hooks = {};
  }

  // sharing hooks
  if (options.hooks.computeShares == null) {
    jiff.hooks.computeShares = client_asyncshare.sharing_schemes.shamir_share;
  } else {
    jiff.hooks.computeShares = options.hooks.computeShares;
  }
}

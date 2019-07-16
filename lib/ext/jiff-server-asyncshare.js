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

  jiff.triplet = function (computation_id, from_id, msg) {
    // decrypt and verify signature
    try {
      msg = jiff.hooks.decryptSign(jiff, msg, jiff.secret_key_map[computation_id], jiff.key_map[computation_id][from_id]);
      msg = JSON.parse(msg);
    } catch (error) { // invalid signature
      console.log('error decrypting message');
      jiff.hooks.log(jiff, 'Error in triplet from ' + computation_id + '-' + from_id + ': ' + error);
      return { success: false, error: 'invalid signature'};
    }

    try {
      msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'triplet', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    // request/generate triplet share.
    var triplet_msg = jiff.request_triplet_share(msg, computation_id, from_id);

    //{triplet: all_triplets[triplet_id][from_id], triplet_id: triplet_id};
    triplet_msg = jiff.execute_array_hooks('afterOperation', [jiff, 'triplet', computation_id, from_id, triplet_msg], 4);
    triplet_msg = JSON.stringify(triplet_msg);

    // encrypt an sign message then send it.
    var pkey = jiff.key_map[computation_id][from_id];
    triplet_msg = jiff.hooks.encryptSign(jiff, triplet_msg, pkey, jiff.secret_key_map[computation_id]);
    return { success: true, message: triplet_msg };
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
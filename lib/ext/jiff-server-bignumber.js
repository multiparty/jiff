global.crypto = require('crypto');
var client_bignumber = require('./jiff-client-bignumber');
var BigNumber = require('bignumber.js');
BigNumber.config({RANGE: 100000000, EXPONENTIAL_AT: 100000000, CRYPTO: true});

module.exports = {
  // Create a server instance that can be used to manage all the computations and run server side code.
  make_jiff: function (base_instance) {
    var jiff = base_instance;

    // helpers
    jiff.helpers.random = function (max) {
      return BigNumber.random().times(max).floor();
    };

    var base_compute = jiff.compute;
    jiff.compute = function (computation_id, options) {
      var base_computation_instance = base_compute(computation_id, options);
      return client_bignumber.make_jiff(base_computation_instance, options);
    };

    // Reusable functions/code for generating/requesting numbers and triplets shares.
    jiff.request_triplet_share = function (msg, computation_id, from_id) {
      // parse message
      msg = JSON.parse(msg);

      var triplet_id = msg.triplet_id;
      var receivers = msg.receivers;
      var threshold = msg.threshold;
      var Zp = new BigNumber(msg.Zp);

      if (jiff.logs) {
        console.log('triplet ' + triplet_id + ' from ' + computation_id + '-' + from_id + ':: ' + JSON.stringify(msg));
      }

      if (jiff.triplets_map[computation_id] == null) {
        jiff.triplets_map[computation_id] = {};
      }

      var all_triplets = jiff.triplets_map[computation_id];
      if (all_triplets[triplet_id] == null) { // Generate Triplet.
        var a = jiff.helpers.random(Zp);
        var b = jiff.helpers.random(Zp);
        var c = a.times(b).mod(Zp);

        var jiff_client_imitation = {
          party_count: jiff.totalparty_map[computation_id],
          helpers: {
            random: jiff.helpers.random,
            BigNumber: function (n) {
              return new BigNumber(n);
            },
            mod: function (x, y) {
              x = new BigNumber(x);
              y = new BigNumber(y);
              if (x.isNeg()) {
                return x.mod(y).plus(y);
              }
              return x.mod(y);
            },
            get_party_number: function (party_id) {
              if (typeof(party_id) === 'number') {
                return party_id;
              }
              if (party_id.startsWith('s')) {
                return jiff_client_imitation.party_count + parseInt(party_id.substring(1), 10);
              }
              return parseInt(party_id, 10);
            }
          }
        };

        var a_shares = client_bignumber.sharing_schemes.shamir_share(jiff_client_imitation, a, receivers, threshold, Zp);
        var b_shares = client_bignumber.sharing_schemes.shamir_share(jiff_client_imitation, b, receivers, threshold, Zp);
        var c_shares = client_bignumber.sharing_schemes.shamir_share(jiff_client_imitation, c, receivers, threshold, Zp);

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

      return JSON.stringify({triplet: all_triplets[triplet_id][from_id], triplet_id: triplet_id});
    };

    jiff.request_number_share = function (msg, computation_id, from_id) {
      // parse message/request
      msg = JSON.parse(msg);

      var base_number_id = msg.number_id;
      var receivers = msg.receivers;
      var threshold = msg.threshold;
      var Zp = new BigNumber(msg.Zp);
      var count = msg.count;

      var bit = msg.bit;
      var nonzero = msg.nonzero;
      var max = msg.max;
      if (max == null) {
        max = Zp;
      }
      max = new BigNumber(max);

      if (jiff.logs) {
        console.log('number ' + base_number_id + ' from ' + computation_id + '-' + from_id + ':: ' + JSON.stringify(msg));
      }

      if (jiff.numbers_map[computation_id] == null) {
        jiff.numbers_map[computation_id] = {};
      }

      var result = [];
      var all_numbers = jiff.numbers_map[computation_id];
      for (var i = 0; i < count; i++) {
        var number_id = base_number_id + ':' + i;
        if (all_numbers[number_id] == null) { // Generate shares for number.
          var number = jiff.helpers.random(max);

          if (msg.number != null) {
            number = new BigNumber(msg.number);
          } else if (bit === true && nonzero === true) {
            number = new BigNumber(1);
          } else if (bit === true) {
            number = number.mod(2);
          } else if (nonzero === true && number === 0) {
            number = jiff.helpers.random(max.minus(1)).plus(1);
          }

          // Compute shares
          var jiff_client_imitation = {
            party_count: jiff.totalparty_map[computation_id],
            helpers: {
              random: jiff.helpers.random,
              BigNumber: function (n) {
                return new BigNumber(n);
              },
              mod: function (x, y) {
                x = new BigNumber(x);
                y = new BigNumber(y);
                if (x.isNeg()) {
                  return x.mod(y).plus(y);
                }
                return x.mod(y);
              },
              get_party_number: function (party_id) {
                if (typeof(party_id) === 'number') {
                  return party_id;
                }
                if (party_id.startsWith('s')) {
                  return jiff.totalparty_map[computation_id] + parseInt(party_id.substring(1), 10);
                }
                return parseInt(party_id, 10);
              }
            }
          };
          all_numbers[number_id] = client_bignumber.sharing_schemes.shamir_share(jiff_client_imitation, number, receivers, threshold, Zp);
        }
        result.push({number_id: number_id, number: all_numbers[number_id][from_id]});
      }

      return JSON.stringify(result);
    };

    return jiff;
  }
};

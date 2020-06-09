const open_array = function (jiff, shares, parties, op_ids) {
  var i;

  // A base operation id is provided to use for all opens.
  if (typeof(op_ids) === 'string' || typeof(op_ids) === 'number') {
    var tmp = { s1: op_ids };
    for (i = 1; i <= jiff.party_count; i++) {
      tmp[i] = op_ids;
    }
    op_ids = tmp;
  }

  return open_ND_array(jiff, shares, parties, null, op_ids);
};

const open_ND_array = function (jiff, shares, receivers_list, senders_list, op_ids) {
  if (senders_list == null) {
    senders_list = [];
    for (var i = 1; i <= jiff.party_count; i++) {
      senders_list.push(i);
    }
    if (receivers_list == null) {
      receivers_list = Array.from(senders_list);
    }
  }
  var is_sending = senders_list.indexOf(jiff.id) > -1;

  // Compute operation id
  /*
   *if (op_ids == null) {
   *  op_ids = jiff.counters.gen_op_id('open_ND_array', receivers_list.concat(senders_list));
   *}
   */

  var final_deferred = new jiff.helpers.Deferred();
  var final_promise = final_deferred.promise;
  var resolve_open = function (shares) {
    final_deferred.resolve((
      function __open_ND_array(shares, parties, op_ids) {
        if (typeof(shares.length) === 'undefined') {
          return jiff.internal_open(shares, parties);
        } else if (shares.length === 0) {
          return Promise.resolve([]);
        } else {
          var promised_array = [];
          for (var i = 0; i < shares.length; i++) {
            promised_array.push(__open_ND_array(shares[i], parties, op_ids + ':' + i));
          }
          return Promise.all(promised_array);
        }
      }
    )(shares, receivers_list, op_ids));
  };

  if (is_sending) {
    // Must emit the skeleton for any parties that are not holders but are receiving the open
    var skeleton = (function __unwipe(nd_array, replace) {
      if (!(typeof (nd_array.length) === 'undefined') || nd_array.length === 0) {
        var unwiped_array = [];
        for (var k = 0; k < nd_array.length; k++) {
          unwiped_array.push(__unwipe(nd_array[k], replace));
        }
        return unwiped_array;
      }
      return replace;
    })(shares, null);
    jiff.emit(op_ids + 'skeleton', receivers_list, JSON.stringify(skeleton));

    resolve_open(shares);
  } else {
    // Populate skeleton with imitation shares
    var revive_shares = function (skeleton) {
      const share = new jiff.SecretShare({}, senders_list, senders_list.length, jiff.Zp);
      return (function __unwipe(nd_array, replace) {
        if (nd_array != null && !(typeof (nd_array.length) === 'undefined' && nd_array.length > 0)) {
          var unwiped_array = [];
          for (var k = 0; k < nd_array.length; k++) {
            unwiped_array.push(__unwipe(nd_array[k], replace));
          }
          return unwiped_array;
        }
        return replace;
      })(skeleton, share);
    }

    // If this party is not a sender, then the variable `shares` may be a skeleton
    if (shares != null) {
      // Use existing shares as skeleton to revive
      shares = revive_shares(shares);
      resolve_open(shares);
    } else {
      // Receive skeleton from senders
      jiff.listen(op_ids + 'skeleton',  function (sender, skeleton) {
        jiff.remove_listener(op_ids + 'skeleton');  // This doesn't seem to work

        if (typeof(skeleton) === 'string') {
          skeleton = JSON.parse(skeleton);
        }

        shares = revive_shares(skeleton);
        resolve_open(shares);
      });
    }
  }

  return final_promise;
};

const receive_open_ND_array = function (jiff, receivers_list, senders_list, threshold, Zp, op_ids) {
  return open_ND_array(jiff, null, receivers_list, senders_list, op_ids);
};

module.exports = {
  open_array: open_array,
  open_ND_array: open_ND_array,
  receive_open_ND_array: receive_open_ND_array
};

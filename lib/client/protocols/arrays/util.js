const sanitize_array_params = function (jiff, receivers_list, senders_list, threshold, Zp, share_id) {
  [receivers_list, senders_list] = [receivers_list, senders_list].map(function (party_list) {
    if (party_list == null) {
      party_list = [];
      for (var i = 1; i <= jiff.party_count; i++) {
        party_list.push(i);
      }
    }
    jiff.helpers.sort_ids(party_list);  // sort to get the same order
    return party_list;
  });

  if (threshold == null) {
    threshold = receivers_list.length;
  } else if (threshold < 0) {
    threshold = 2;
  } else if (threshold > receivers_list.length) {
    threshold = receivers_list.length;
  }

  if (Zp == null) {
    Zp = jiff.Zp;
  }

  if (share_id == null) {  // Make a unique id for this array
    share_id = jiff.counters.gen_op_id2('share_array', receivers_list, senders_list);
  }

  return [receivers_list, senders_list, threshold, Zp, share_id];
};

const skeleton_of = function (jiff, nd_array, replace) {
  if (typeof(replace) === 'undefined') {
    replace = null;
  }
  if (!(typeof(nd_array.length) === 'undefined') || nd_array.length === 0) {
    var wiped_array = [];
    for (var k = 0; k < nd_array.length; k++) {
      wiped_array.push(jiff.skeleton_of(nd_array[k], replace));
    }
    return wiped_array;
  }
  return replace;
};

const match_skeletons = function (jiff, skeletons, senders_list) {
  var keys = Object.keys(skeletons);
  var expected_keys = senders_list.map(String);
  if (keys.length === senders_list.length) {
    for (var i = 0; i < senders_list.length; i++) {
      if (!(keys[i] === expected_keys[i])) {
        console.log('senders: ', senders_list);
        console.log('skeleton keys', keys);
        throw new Error('Keys of parameter \'skeletons\' should be the same as the senders');
      }
    }
  } else {
    throw new Error('Invalid parameter \'skeletons\'');
  }
};

module.exports = {
  sanitize_array_params: sanitize_array_params,
  skeleton_of: skeleton_of,
  match_skeletons: match_skeletons
};

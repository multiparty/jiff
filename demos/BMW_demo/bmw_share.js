function bmw_compute_share(jiff,input,n, threshold, Zp) {
  var ls={};// potential shares of length n
  for (var i=1;i<=n-1;i++) {
    var b=Math.floor(Math.random()*2); // random from 0,1
    ls[i]=b;

  }
  var sum=ls[1];
  for (i=2;i<=n-1;i++) {
    sum=sum^ls[i];
  }
  sum=sum^input;
  ls[n]=sum;
  console.log('my compute for '+jiff.id);
  console.log(ls);

  return ls;

}


// share the secret to corresponding party i with corresponding share[i]
function bmw_jiff_share(jiff, secret, threshold, receivers_list, senders_list, Zp, share_id) {

  var i, p_id;

  // defaults
  if (Zp == null) {
    Zp = jiff.Zp;
  }
  if (receivers_list == null) {
    receivers_list = [];
    for (i = 1; i <= jiff.party_count; i++) {
      receivers_list.push(i);
    }
  } else {
    jiff.helpers.sort_ids(receivers_list);
  }

  console.log('sec in jiff share'+secret);
  if (senders_list == null) {
    senders_list = [];
    for (i = 1; i <= jiff.party_count; i++) {
      senders_list.push(i);
    }
  } else {
    jiff.helpers.sort_ids(senders_list);
  }
  if (threshold == null) {
    threshold = receivers_list.length;
  }
  if (threshold < 0) {
    threshold = 2;
  }
  if (threshold > receivers_list.length) {
    threshold = receivers_list.length;
  }

  // if party is uninvolved in the share, do nothing
  if (receivers_list.indexOf(jiff.id) === -1 && senders_list.indexOf(jiff.id) === -1) {
    return {};
  }


  // compute operation id
  if (share_id == null) {
    share_id = jiff.counters.gen_op_id2('share', receivers_list, senders_list);
  }

  // stage sending of shares
  if (senders_list.indexOf(jiff.id) > -1) {
    // Call hook
    secret = jiff.hooks.execute_array_hooks('beforeShare', [jiff, secret, threshold, receivers_list, senders_list, Zp], 1);

    // compute shares
    //var shares = jiff.hooks.computeShares(jiff, secret, receivers_list, threshold, Zp);
    var shares=bmw_compute_share(jiff,secret,jiff.party_count, threshold, Zp);
    // Call hook

    shares = jiff.hooks.execute_array_hooks('afterComputeShare', [jiff, shares, threshold, receivers_list, senders_list, Zp], 1);

    // send shares
    for (i = 0; i < receivers_list.length; i++) {
      p_id = receivers_list[i];
      if (p_id === jiff.id) {
        continue;
      }

      // send encrypted and signed shares_id[p_id] to party p_id
      var msg = {party_id: p_id, share: shares[p_id], op_id: share_id};
      console.log('sending msg to '+msg.party_id+' value:'+msg.share);

      msg = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'share', msg], 2);
      msg['share'] = jiff.hooks.encryptSign(jiff, msg['share'].toString(10), jiff.keymap[msg['party_id']], jiff.secret_key);
      //console.log("msg"+JSON.stringify(msg)+" "+msg.share);
      jiff.socket.safe_emit('share', JSON.stringify(msg));

    }
  }

  // stage receiving of shares
  var result = {};
  if (receivers_list.indexOf(jiff.id) > -1) {
    // setup a map of deferred for every received share
    if (jiff.deferreds[share_id] == null) {
      jiff.deferreds[share_id] = {};
    }

    var _remaining = senders_list.length;
    for (i = 0; i < senders_list.length; i++) {
      p_id = senders_list[i];
      if (p_id === jiff.id) { // Keep party's own share
        var my_share = jiff.hooks.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
        result[p_id] = new jiff.SecretShare(my_share, receivers_list, threshold, Zp);
        _remaining--;
        continue;
      }

      // check if a deferred is set up (maybe the message was previously received)
      if (jiff.deferreds[share_id][p_id] == null) { // not ready, setup a deferred
        jiff.deferreds[share_id][p_id] = new jiff.helpers.Deferred();

      }

      var promise = jiff.deferreds[share_id][p_id].promise;
      // destroy deferred when done
      (function (promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
        promise.then(function () {
          delete jiff.deferreds[share_id][p_id];
          _remaining--;
          if (_remaining === 0) {
            delete jiff.deferreds[share_id];
          }
        });
      })(promise, p_id);

      // receive share_i[id] from party p_id
      result[p_id] = new jiff.SecretShare(promise, receivers_list, threshold, Zp);
    }
  }

  return result;
}


module.exports = {
  bmw_compute_share: bmw_compute_share,
  bmw_jiff_share:bmw_jiff_share
};





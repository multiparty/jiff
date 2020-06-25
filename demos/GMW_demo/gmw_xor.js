
//public xor locally on my shares a0,b0, var ci=ai^bi;
const GMW=require('./gmw_share.js');
function gmw_xor(jiff,sec,rels,sendls) {
  var allPromises=[];
  for (var k = 0; k <rels.length; k++) {
    allPromises.push(sec[rels[k]].value);

  }

  var final_deferred = new jiff.helpers.Deferred();
  var final_promise = final_deferred.promise;
  var result = new jiff.SecretShare(final_promise,rels, rels.length, jiff.Zp);

  Promise.all(allPromises).then( function (v) {
    var ci= v[sendls[0]-1]^v[sendls[1]-1];
    //console.log('vv',sec,ci);
    //    var share_id;
    //    var p_id;
    // var secret;
    // var i;
    // if (share_id == null) {
    //   share_id = jiff.counters.gen_op_id2('share', rels, rels);
    //   //console.log('no share',share_id);
    // }
    final_deferred.resolve(ci);
  });
  return result;


  /*

  // stage sending of shares
  if (rels.indexOf(jiff.id) > -1) {
    // Call hook
    secret = jiff.hooks.execute_array_hooks('beforeShare', [jiff, ci, rels.length, rels, rels, jiff.Zp], 1);

    // compute shares
   // var shares=GMW.gmw_compute_share(jiff,secret,rels, rels.length, jiff.Zp);
    var shares={};
    for ( var j=1;j<=rels.length;j++) {
      shares[j]=ci;
    }
    console.log('my compute share in xor',shares);
    // Call hook

    shares = jiff.hooks.execute_array_hooks('afterComputeShare', [jiff, shares, rels.length, rels, rels, jiff.Zp], 1);

    // send shares
    for ( i = 0; i < rels.length; i++) {
      p_id = rels[i];
      if (p_id === jiff.id) {
        continue;
      }

      // send encrypted and signed shares_id[p_id] to party p_id
      var msg = {party_id: p_id, share: shares[p_id], op_id: share_id};

      console.log("sending msg", jiff.id, "op_id:",msg.op_id);
      msg = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'share', msg], 2);
      msg['share'] = jiff.hooks.encryptSign(jiff, msg['share'].toString(10), jiff.keymap[msg['party_id']], jiff.secret_key);
      console.log("msg xor"+JSON.stringify(msg)+" "+msg.share);
      jiff.socket.safe_emit('share', JSON.stringify(msg));

    }
  }
  var result = {};
  //share_id=' share:1,2,3:1,2,3:1';
  //console.log("nnop_id:",msg.op_id);
  if (rels.indexOf(jiff.id) > -1) {
    // setup a map of deferred for every received share
    if (jiff.deferreds[share_id] == null) {
      jiff.deferreds[share_id] = {};
    }

    var _remaining = rels.length;
    for (i = 0; i < rels.length; i++) {
      p_id = rels[i];
      if (p_id === jiff.id) { // Keep party's own share
        var my_share = jiff.hooks.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
        console.log('ccc',my_share,ci);
        result[p_id] = new jiff.SecretShare(my_share, rels, rels.length, jiff.Zp);
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
      result[p_id] = new jiff.SecretShare(promise, rels, rels.length, jiff.Zp);
    }
  }*/
  //return result;
}

module.exports = {
  gmw_xor: gmw_xor
};
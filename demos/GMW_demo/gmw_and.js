
/**
 * AND on two shares, return secret share of ci.
 * @function gmw_and
 * @param {module:jiff-client~JIFFClient} jiff - the jiff instance
 * @param {number} secret - the secret1 to share.
 * @param {number} secret - the secret2 to share.
 * @returns {object} a secret share of value ci
 */

function gmw_and(jiff,share1,share2) {
  if (!(share1.jiff === share2.jiff)) {
    throw new Error('shares do not belong to the same instance (^)');
  }
  if (!share1.jiff.helpers.Zp_equals(share1, share2)) {
    throw new Error('shares must belong to the same field (^)');
  }
  if (!share1.jiff.helpers.array_equals(share1.holders, share2.holders)) {
    throw new Error('shares must be held by the same parties (^)');
  }

  // AND the two shares when ready
  var ready = function () {
    var final_deferred = new jiff.helpers.Deferred();
    var final_promise = final_deferred.promise;
    var wi= share1.value & share2.value;
    var csecret=[];
    csecret.push(share1.value);
    csecret.push(share2.value);
    // receivinglist of OT msg
    var recls=[];
    var i;
    for ( i=1;i<=jiff.party_count;i++) {
      if (i<jiff.id) {
        recls.push(i);
      }
    }

    var share_id ;
    if (share_id==null) {
      share_id= jiff.counters.gen_op_id2('otshare', share1.holders, share1.holders);
    }
    var my_count;//list of promises needs to be resolve
    if (typeof (my_count) === 'undefined') {
      my_count= initial_deferreds(jiff,share_id);
    }
    // generate OT msg
    var four_opts={};
    four_opts['opts']=OTGate(csecret);// jason object
    four_opts['sender_id']=jiff.id;
    four_opts['op_id']=share_id;
    four_opts = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'open', four_opts], 2);
    var mymsg=JSON.stringify(four_opts);
    var help=[];
    help.push(wi);
    //wi resolve local wi; special case: jiff.id===jiff.party_count, return value
    jiff.deferreds[share_id][jiff.id].resolve(help);

    // OT send process, send OT msg to small party_ids
    jiff.emit('OT',recls,mymsg,true);

    // OT receive process receive from larger party_ids' OT msg
    for ( var ssid=jiff.id+1;ssid<=jiff.party_count;ssid++) {

      jiff.listen('OT',function (ssid,msg) {
        msg=JSON.parse(msg);
        var sendId=msg['sender_id'];
        var opId=msg['op_id'];
        var opts=msg['opts'];
        if (jiff.deferreds[opId] == null) {
          jiff.deferreds[opId] = {};
        }
        if (jiff.deferreds[opId][sendId] == null) { // not ready, setup a deferred
          jiff.deferreds[opId][sendId] = new jiff.helpers.Deferred();
        }
        jiff.deferreds[opId][sendId].resolve(opts);
      });
    }
    // compute ci to return
    Promise.all(my_count).then(function (v) {
      //v= [ [ 0 ], [ 0, 0, 0, 0 ], [ 0, 1, 0, 1 ] ]

      // choose one result from 4 options
      var find = function (msgls,csecret) {
        var choose=2*csecret[0]+csecret[1];// 0,1,2,3
        var one=msgls[choose];
        return one;
      }

      var re=0;
      for ( i=0;i<v.length;i++) {
        var cur=v[i];
        if (cur.length===1) {
          re=re^cur[0];
        } else {
          var ans=find(cur,csecret);// ot select one answer from 4 options
          re=re^ans;
        }
      }

      var _remaining=jiff.party_count-jiff.id+1;
      for (i =jiff.id;i<=jiff.party_count;i++) {
        if (jiff.deferreds[share_id][i]!=='undefined') {
          var mpromise=jiff.deferreds[share_id][i].promise;
          (function (mpromise, i) { // p_id is modified in a for loop, must do this to avoid scoping issues.
            mpromise.then(function ()  {
              delete jiff.deferreds[share_id][i];
              _remaining--;
              if (_remaining === 0) {
                delete jiff.deferreds[share_id];
              }
            });
          })(mpromise, i);
        }
      }
      final_deferred.resolve(re);

    });

    return final_promise;
  };

  return new share1.jiff.SecretShare(share1.when_both_ready(share2, ready), share1.holders, Math.max(share1.threshold, share2.threshold), share1.Zp);

}

/**
 * compute 4 OT options in a list of length 4
 * @function OTGate
 * @param {number} list of secrect share(length 2)
 * @returns {object} list of number(length=4)
 */
function OTGate(i_shares) {
  var OT_option = function (cx,cy,i_shares) {
    var op=(cx&i_shares[1])^(cy&i_shares[0]);
    return op;
  };
  var opt1=OT_option(0,0,i_shares);
  var opt2=OT_option(0,1,i_shares);
  var opt3=OT_option(1,0,i_shares);
  var opt4=OT_option(1,1,i_shares);
  var re=[];
  re.push(opt1);
  re.push(opt2);
  re.push(opt3);
  re.push(opt4);
  return re;
}


/**
 * function to get promises list to be resolve.
 * @function initial_deferreds
 * @param {module:jiff-client~JIFFClient} jiff - the jiff instance
 * @param {number} share_id of the deferreds
 * @returns {object} list of promise tp be resolve
 */
function initial_deferreds(jiff,share_id) {
  if (jiff.deferreds[share_id] == null) {
    jiff.deferreds[share_id] = {};
  }
  var re=[];// list of promises to resolve
  for (var i=jiff.id;i<=jiff.party_count;i++) {
    if (jiff.deferreds[share_id][i] == null) { // not ready, setup a deferred
      jiff.deferreds[share_id][i] = new jiff.helpers.Deferred();
    }
    re.push( jiff.deferreds[share_id][i].promise);

  }
  return re;
}

module.exports = {
  gmw_and: gmw_and
};

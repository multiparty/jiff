/**
OT
**/
$ = require('jquery-deferred');
// party i :  receive aibj+ajbi from party j;
// get choose then ^aibi
// then share result to party i, j sxor to open
// if i>j
//ssid: send OT msg to party_id list
function initial_count(jiff,share_id) {
  if (jiff.deferreds[share_id] == null) {
    jiff.deferreds[share_id] = {};
  }
  var re=[];// promises waiting for
  for (var i=jiff.id;i<=jiff.party_count;i++) {
    if (jiff.deferreds[share_id][i] == null) { // not ready, setup a deferred
      jiff.deferreds[share_id][i] = new jiff.helpers.Deferred();
    }
    re.push( jiff.deferreds[share_id][i].promise);

  }
  //console.log(jiff.id,share_id,'!!now get counts ',re);
  return re;
}

function find(jiff,msgls,csecret) {
  var choose=2*csecret[0]+csecret[1];
  var one=msgls[choose];
  return one;

}

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



  // XOR the two shares when ready locally
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
    for (i=1;i<=jiff.party_count;i++) {
      if (i<jiff.id) {
        recls.push(i);
      }
    }

    var share_id ;
    if (share_id==null) {
      share_id= jiff.counters.gen_op_id2('otshare', share1.holders, share1.holders);
      //console.log(jiff.id,'first op_gen1',share_id);
    }
    var my_count;// deferlist
    if (typeof (my_count) === 'undefined') {
      my_count= initial_count(jiff,share_id);
    }
    //console.log(jiff.id,'no share',share_id,my_count);
    // generate OT msg
    var four_opts={};
    four_opts['opts']=OTGate(csecret);// jason object
    four_opts['sender_id']=jiff.id;
    four_opts['op_id']=share_id;
    four_opts = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'open', four_opts], 2);
    var mymsg=JSON.stringify(four_opts);
    //if (jiff.id<ssid) {
    //console.log(jiff.id,share_id,'send OT msg to  ',recls);
    var help1=[];
    help1.push(wi);
    jiff.deferreds[share_id][jiff.id].resolve(help1);//wi resolve local wi; when jiff.id===jiff.party_count, simple return
    //console.log(jiff.id,share_id,'wi=',wi,my_count);

    // OT send process
    jiff.emit('OT',recls,mymsg,true);

    // OT receive process
    for ( var ssid=jiff.id+1;ssid<=jiff.party_count;ssid++) {

      jiff.listen('OT',function (ssid,msg) {
        msg=JSON.parse(msg);
        var sendId=msg['sender_id'];
        var opId=msg['op_id'];
        var opts=msg['opts'];
        //console.log(jiff.id,'get ot msg from',sendId,msg['op_id'],'!!',share_id,msg,opts);
        if (jiff.deferreds[opId] == null) {
          jiff.deferreds[opId] = {};
        }
        if (jiff.deferreds[opId][sendId] == null) { // not ready, setup a deferred
          jiff.deferreds[opId][sendId] = new jiff.helpers.Deferred();
        }
        jiff.deferreds[opId][sendId].resolve(opts);
      });
    }

    Promise.all(Object.values( my_count)).then(function (v) {
      //v= [ [ 0 ], [ 0, 0, 0, 0 ], [ 0, 1, 0, 1 ] ]
      var re=0;
      for ( var i=0;i<v.length;i++) {
        var cur=v[i];
        if (cur.length===1) {
          re=re^cur[0];
        } else {
          var ans=find(jiff,cur,csecret);// ot select
          re=re^ans;
        }
      }

      var _remaining=jiff.party_count-jiff.id+1;
      for ( i =jiff.id;i<=jiff.party_count;i++) {
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
      //console.log(jiff.id,share_id,'my ci',re);
      final_deferred.resolve(re);

    });

    return final_promise;
  };


  return new share1.jiff.SecretShare(share1.when_both_ready(share2, ready), share1.holders, Math.max(share1.threshold, share2.threshold), share1.Zp);

}
//var wi= v[sendls[0]-1]&v[sendls[1]-1];
function OT_option(cx,cy,i_shares) {
  var op=(cx&i_shares[1])^(cy&i_shares[0]);
  return op;
}

function OTGate(i_shares) {
  var opt1=OT_option(0,0,i_shares);
  var opt2=OT_option(0,1,i_shares);
  var opt3=OT_option(1,0,i_shares);
  var opt4=OT_option(1,1,i_shares);
  var re=[];
  re.push(opt1);
  re.push(opt2);
  re.push(opt3);
  re.push(opt4);
  // var re={};
  // re['0,0:']=opt1;
  // re['0,1:']=opt2;
  // re['1,0:']=opt3;
  // re['1,1:']=opt4;
  return re;
}

module.exports = {
  gmw_and: gmw_and
};

/**
OT
**/



// csecret=={""}
const BMW=require('./bmw_share.js');
const BMW_OPEN=require('./bmw_open.js');
function send_opts(jiff,csecret, threshold, receivers_list, senders_list, Zp, share_id) {
  if (receivers_list == null) {
    receivers_list = [];
    var i;
    for (i = 1; i <= jiff.party_count; i++) {
      if (jiff.id!==i) {
        receivers_list.push(i);
      }
    }
  }
  console.log('in send_ops');
  var four_opts=OTGate(csecret);// object
  four_opts['sender_id']=jiff.id;
  four_opts = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'open', four_opts], 2);
  var mymsg=JSON.stringify(four_opts);
  console.log('fmsg'+mymsg);
  console.log('send msg to ');
  console.log(receivers_list);
  jiff.emit('custom',receivers_list,mymsg,true);
  var ssid=1;
  if (jiff.id===1) {
    ssid=2;
  }
  jiff.listen('custom',function (ssid,msg) {

    console.log('hh'+msg);
    msg=JSON.parse(msg);

    //var sid=msg['sender_id'];
    var my_choose=csecret[1]+','+csecret[2];

    var result=msg[my_choose];
    console.log('my json get'+my_choose+' '+result+' id'+jiff.id);


    var output_shares=BMW.bmw_jiff_share(jiff,result);
    //console.log('output_share');
    //console.log(output_shares);

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();
    var allPromises = [];
    for (var k = 1; k <=Object.keys(output_shares).length; k++) {
      allPromises.push(BMW_OPEN.bmw_jiff_open(jiff,output_shares[k]));
      //  allPromises.push(output_shares[k].value);
    }

    Promise.all(allPromises).then(function (results) {
      console.log('open up in ot!',results);
      console.log(output_shares);
      jiff.disconnect(true, true);

      // final_deferred.resolve(results);

    });
    // return final_promise;
  /*
	final_promise.then(function (v) {
	console.log("reconstruct");
	var csec={'1':v[0],'2':v[1]};
    console.log(csec);
	var re=ooo(jiff,v);
	console.log(re);
	});
	*/
  });

  //bmw_constant_share(jiff, four_opts, threshold, receivers_list, senders_list, Zp, share_id);
}
/*
function bmw_constant_share(jiff, four_opts, threshold, receivers_list, senders_list, Zp, share_id) {
  // 1001,,,
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
    // four_opts = jiff.hooks.execute_array_hooks('beforeShare', [jiff, four_opts, threshold, receivers_list, senders_list, Zp], 1);

    // compute shares
    var shares=four_opts;
    // Call hook
    //  shares = jiff.hooks.execute_array_hooks('afterComputeShare', [jiff, shares, threshold, receivers_list, senders_list, Zp], 1);

    // send shares
    for (i = 0; i < receivers_list.length; i++) {
      p_id = receivers_list[i];
      if (p_id === jiff.id) {
        continue;
      }

      // send encrypted and signed shares_id[p_id] to party p_id
      var msg = {party_id: p_id, share: shares[p_id], op_id: share_id};
		 console.log('!!sendingOTmsg '+msg.share+' '+msg.party_id);
      msg = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'share', msg], 2);
      msg['share'] = jiff.hooks.encryptSign(jiff, msg['share'].toString(90), jiff.keymap[msg['party_id']], jiff.secret_key);
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
*/

function OT_option(cx,cy,i_shares) {
  var op=(cx&i_shares[1])^(cy&i_shares[2]);
  return op;
}

function OTGate(i_shares) {
  var opt1=OT_option(0,0,i_shares);
  var opt2=OT_option(0,1,i_shares);
  var opt3=OT_option(1,0,i_shares);
  var opt4=OT_option(1,1,i_shares);
  var msg={'0,0':opt1,'0,1':opt2,'1,0':opt3,'1,1':opt4};
  return msg;
}
/*
function ooo(ls) {
  var re=ls[1];
  for (var i=2;i<=Object.keys(ls).length;i++) {
    re=re^ls[i];

  }
  return re;

}
*/
module.exports = {
  send_opts: send_opts,
//  bmw_jiff_share:bmw_jiff_share
};

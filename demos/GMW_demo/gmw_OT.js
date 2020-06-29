/**
OT
**/
// csecret=={1:,2:}
const GMW=require('./gmw_share.js');
const GMW_OPEN=require('./gmw_open.js');
//const ascii = require('./ascii.js');
$ = require('jquery-deferred');

// party i :  receive aibj+ajbi from party j;
// get choose then ^aibi
// then share result to party i, j sxor to open
// if i>j
//ssid: send OT msg to party_id list
function counter(counts,n) {
  for (var k=1;k<=n;k++) {
    counts[k]=0;
  }

  return counts;
}

function gmw_and(jiff,sec,sendls,rels) {
  //jiff.seed_ids(seed);
  if (rels==null||rels===[]) {
    rels = [];
    for ( var i=1;i<=jiff.party_count;i++) {
      rels.push(i);
    }
  }

  var allPromises=[];
  for (var k = 0; k <rels.length; k++) {
    allPromises.push(sec[rels[k]].value);

  }

  var final_deferred = new jiff.helpers.Deferred();
  var final_promise = final_deferred.promise;
  var result = new jiff.SecretShare(final_promise,rels, rels.length, jiff.Zp);
  var counts={};
  counts= counter(counts,jiff.party_count);
  console.log('check count:',jiff.id,counts);
  Promise.all(allPromises).then( function (v) {
    var wi= v[sendls[0]-1]&v[sendls[1]-1];
    var csecret=[];
    var p_id=jiff.id;
    for ( i=0;i<2;i++) {
      csecret.push(v[sendls[i]-1]);
    }
    // receivinglist of OT msg
    var recls=[];
    for (i=0;i<rels.length;i++) {
      if (rels[i]<jiff.id) {
        recls.push(rels[i]);
      }
    }

    var share_id = jiff.counters.gen_op_id2('share', rels, rels);
    console.log(jiff.id,'no share',share_id);
    var four_opts=OTGate(csecret);// jason object
    four_opts['sender_id']=jiff.id;
    four_opts['op_id']=share_id;
    four_opts = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'open', four_opts], 2);
    var mymsg=JSON.stringify(four_opts);
    var w2=0;
    //if (jiff.id<ssid) {
 //   var count=jiff.party_count-p_id;
    var my_choose=csecret[0]+','+csecret[1]+':';
//    console.log(jiff.id,'cc',count);


    //console.log(jiff.id,counts);
    console.log(jiff.id,share_id,'send OT msg to  ',recls);
    jiff.emit('OT',recls,mymsg,true);


    // receive OT msg
    if (jiff.id===jiff.party_count) {//jiff.id>ssid
      final_deferred.resolve(wi);
      console.log(jiff.id,share_id,' in simple return','wi=',wi);
    }

    for ( var ssid=p_id+1;ssid<=jiff.party_count;ssid++) {
      jiff.listen('OT',function (ssid,msg) {
        msg=JSON.parse(msg);
        console.log(jiff.id,'get ot msg from',msg['sender_id'],msg['op_id'],'!',share_id);
        //if (msg.op_id===share_id) {
        var select=msg[my_choose];
        w2= w2^select;
        console.log(jiff.id,counts);
        counts[jiff.id]=counts[jiff.id]+1;
        console.log(jiff.id,share_id,'my json get op_id=',msg['op_id'],' from sender='+msg['sender_id'],'cc=',counts[jiff.id],counts);
        //console.log('my json get'+my_choose+' id'+msg['sender_id'],'result=',select);
        if (counts[jiff.id]===jiff.party_count-jiff.id) {
          // checking when it should be returning
          // because of asyncnous, the count is not correct, has some issue.
          
          w2=wi^w2;
          //counts[jiff.id]=0;
          console.log(jiff.id,msg['op_id'],'return ',msg['op_id'],'ci=',w2);
          final_deferred.resolve(w2);
        }
        //}
      });
    }

  });
  return result;


/*


    if (jiff.id===jiff.party_count) {//jiff.id>ssid
    //final_deferred.resolve(wi);
    f=wi;
    console.log('in simple return',wi);
////
    f = jiff.hooks.execute_array_hooks('beforeShare', [jiff, f, rels.length, rels, rels, jiff.Zp], 1);

    // compute shares
    //var shares = jiff.hooks.computeShares(jiff, secret, receivers_list, threshold, Zp);  
    var shares={};
    for ( var j=1;j<=rels.length;j++) {
      shares[j]=f;
    }
    //gmw_compute_share(jiff,my_share,receivers_list, threshold, jiff.Zp);

    // Call hook

    shares = jiff.hooks.execute_array_hooks('afterComputeShare', [jiff, shares, rels.length, rels, rels, jiff.Zp], 1);

    // send shares
    for (i = 0; i < rels.length; i++) {
      p_id = rels[i];
      if (p_id === jiff.id) {
        continue;
      }

      // send encrypted and signed shares_id[p_id] to party p_id
      var msg = {party_id: p_id, share: shares[p_id], op_id: share_id};

      console.log("sending msg", jiff.id, "op_id:",msg.op_id);
      msg = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'share', msg], 2);
      msg['share'] = jiff.hooks.encryptSign(jiff, msg['share'].toString(10), jiff.keymap[msg['party_id']], jiff.secret_key);
      //console.log("msg"+JSON.stringify(msg)+" "+msg.share);
      jiff.socket.safe_emit('share', JSON.stringify(msg));

    }
  //}

    
 // if (receivers_list.indexOf(jiff.id) > -1) {
    // setup a map of deferred for every received share
    var result = {};
    if (jiff.deferreds[share_id] == null) {
      jiff.deferreds[share_id] = {};
    }

    var _remaining = rels.length;
      for (i = 0; i < rels.length; i++) {
      p_id = rels[i];

      if (p_id === jiff.id) { // Keep party's own share
        //var my_share = final_promise.value; //jiff.hooks.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);      
        var my = jiff.hooks.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
        //result[p_id] = new jiff.SecretShare(my_share, receivers_list, threshold, Zp);
        result[p_id] = new jiff.SecretShare(my, rels, rels.length, jiff.Zp);
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
  
    //return result;


/////
  }


  var w2=0;
  var count=jiff.party_count-jiff.id;
  var my_choose=csecret[0]+','+csecret[1]+':';
  for ( var ssid=jiff.id+1;ssid<=jiff.party_count;ssid++) {
    console.log('for','ssid=',ssid);
    jiff.listen('OT',function (ssid,msg) {
      msg=JSON.parse(msg);
      console.log('for','ot=',msg);
      if(msg.op_id===share_id){
      var res=msg[my_choose];
      w2= w2^res;
      count--;
      console.log('my json get'+my_choose+' id'+msg['sender_id'],'result=',res,'c=',count,'w2=',w2,'wic',wi);
      if (count===0) {
        w2=wi^w2;
        f=w2;
        console.log('ci=',w2);
       ////
       

    f = jiff.hooks.execute_array_hooks('beforeShare', [jiff, f, rels.length, rels, rels, jiff.Zp], 1);

    // compute shares
    //var shares = jiff.hooks.computeShares(jiff, secret, receivers_list, threshold, Zp);  
    var shares={};
    for ( var j=1;j<=rels.length;j++) {
      shares[j]=f;
    }
    //gmw_compute_share(jiff,my_share,receivers_list, threshold, jiff.Zp);

    // Call hook

    shares = jiff.hooks.execute_array_hooks('afterComputeShare', [jiff, shares, rels.length, rels, rels, jiff.Zp], 1);

    // send shares
    for (i = 0; i < rels.length; i++) {
      p_id = rels[i];
      if (p_id === jiff.id) {
        continue;
      }

      // send encrypted and signed shares_id[p_id] to party p_id
      var msg = {party_id: p_id, share: shares[p_id], op_id: share_id};

      console.log("sending msg", jiff.id, "op_id:",msg.op_id);
      msg = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'share', msg], 2);
      msg['share'] = jiff.hooks.encryptSign(jiff, msg['share'].toString(10), jiff.keymap[msg['party_id']], jiff.secret_key);
      //console.log("msg"+JSON.stringify(msg)+" "+msg.share);
      jiff.socket.safe_emit('share', JSON.stringify(msg));

    }
  //}

    
 // if (receivers_list.indexOf(jiff.id) > -1) {
    // setup a map of deferred for every received share
    var result = {};
    if (jiff.deferreds[share_id] == null) {
      jiff.deferreds[share_id] = {};
    }

    var _remaining = rels.length;
      for (i = 0; i < rels.length; i++) {
      p_id = rels[i];

      if (p_id === jiff.id) { // Keep party's own share
        //var my_share = final_promise.value; //jiff.hooks.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);      
        var my = jiff.hooks.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
        //result[p_id] = new jiff.SecretShare(my_share, receivers_list, threshold, Zp);
        result[p_id] = new jiff.SecretShare(my, rels, rels.length, jiff.Zp);
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
    final_deferred.resolve(result);
    //return result;


        
    ////
        //final_deferred.resolve(w2);
      }
    }
    });
  }

return final_promise;
*/
  // var fd = $.Deferred();
  // var fp = final_deferred.promise();
  //   var result = {};
  /*
   final_promise.then(function (my_share){
      console.log('myshh',my_share);

    //if (senders_list.indexOf(jiff.id) > -1) {
    // Call hook
    my_share = jiff.hooks.execute_array_hooks('beforeShare', [jiff, my_share, rels.length, rels, rels, jiff.Zp], 1);

    // compute shares
    //var shares = jiff.hooks.computeShares(jiff, secret, receivers_list, threshold, Zp);  
    var shares={};
    for(var i=1;i<=rels.length;i++){
      shares[i]=my_share;
    }
    //gmw_compute_share(jiff,my_share,receivers_list, threshold, jiff.Zp);

    // Call hook

    shares = jiff.hooks.execute_array_hooks('afterComputeShare', [jiff, shares, rels.length, rels, rels, jiff.Zp], 1);

    // send shares
    for (i = 0; i < rels.length; i++) {
      p_id = rels[i];
      if (p_id === jiff.id) {
        continue;
      }

      // send encrypted and signed shares_id[p_id] to party p_id
      var msg = {party_id: p_id, share: shares[p_id], op_id: share_id};

      console.log("sending msg", jiff.id, "op_id:",msg.op_id);
      msg = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'share', msg], 2);
      msg['share'] = jiff.hooks.encryptSign(jiff, msg['share'].toString(10), jiff.keymap[msg['party_id']], jiff.secret_key);
      //console.log("msg"+JSON.stringify(msg)+" "+msg.share);
      jiff.socket.safe_emit('share', JSON.stringify(msg));

    }
  //}
 
 // if (receivers_list.indexOf(jiff.id) > -1) {
    // setup a map of deferred for every received share
    var result = {};
    if (jiff.deferreds[share_id] == null) {
      jiff.deferreds[share_id] = {};
    }

    var _remaining = rels.length;
      for (i = 0; i < rels.length; i++) {
      p_id = rels[i];

      if (p_id === jiff.id) { // Keep party's own share
        //var my_share = final_promise.value; //jiff.hooks.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);      
        var my = jiff.hooks.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
        //result[p_id] = new jiff.SecretShare(my_share, receivers_list, threshold, Zp);
        result[p_id] = new jiff.SecretShare(my, rels, rels.length, jiff.Zp);
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
     fd.resolve(result);
    });
   */

    // for (i = 0; i < rels.slength; i++) {
    //   p_id = rels[i];

    //   if (p_id === jiff.id) { // Keep party's own share
    //     var my_share = final_promise.value; //jiff.hooks.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
    //     result[p_id] = new jiff.SecretShare(my_share, rels, rels.length, jiff.Zp);
    //     _remaining--;
    //     continue;
    //   }

    //   // check if a deferred is set up (maybe the message was previously received)
    //   if (jiff.deferreds[share_id][p_id] == null) { // not ready, setup a deferred
    //     jiff.deferreds[share_id][p_id] = new jiff.helpers.Deferred();

    //   }

    //   var promise = jiff.deferreds[share_id][p_id].promise;
    //   // destroy deferred when done
    //   (function (promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
    //     promise.then(function () {
    //       delete jiff.deferreds[share_id][p_id];
    //       _remaining--;
    //       if (_remaining === 0) {
    //         delete jiff.deferreds[share_id];
    //       }
    //     });
    //   })(promise, p_id);

    //   // receive share_i[id] from party p_id
    //   result[p_id] = new jiff.SecretShare(promise, rels, rels.length, jiff.Zp);
    // }

    // console.log('hhdd',fp);
    // //return result;
    // return fp;
















/*
  if (jiff.id===jiff.party_count) {//jiff.id>ssid
    final_deferred.resolve(wi);
    //console.log('in simple return',wi);
  }
  var w2=0;
  //if (jiff.id<ssid) {
  var count=jiff.party_count-p_id;
  var my_choose=csecret[0]+','+csecret[1]+':';
  for ( var ssid=p_id+1;ssid<=jiff.party_count;ssid++) {
    jiff.listen('OT',function (ssid,msg) {
      msg=JSON.parse(msg);
      var result=msg[my_choose];
      w2= w2^result;
      count--;
      // console.log('my json get'+my_choose+' id'+msg['sender_id'],'result=',result,'c=',count,'w2=',w2,'wic',wi);
      if (count===0) {
        w2=wi^w2;
        final_deferred.resolve(w2);
      }
    });
  }

  return final_promise;
  */

  // OT.then(function (OT) {
  //     OT.send(msg_ot, N);//no for loop but sending list to whom/ tag
  //   });
  // for (j=1;j<p_id;j++) {

  //   OT.then(function (OT) {
  //     OT.send(msg_ot, N);//no for loop but sending list to whom/ tag
  //   });
  // }

  //four ops to send to party who should get
  // no for loop but get negative receive msg of tag OT
  // for (j=p_id+1;j<=jiff.receivers_list.length;j++) {
  //   vj=receive_OT(jiff,csecret);// return the choosed value out of four opts
  //   wi= wi^vj;
  //   console.log('and_re',wi);
  // }
  // return wi;

}


/*
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
  //console.log('in send_ops');
  var four_opts=OTGate(csecret);// object
  four_opts['sender_id']=jiff.id;
  four_opts = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'open', four_opts], 2);
  var mymsg=JSON.stringify(four_opts);
  //console.log('fmsg'+mymsg);
  //console.log('send msg to ');
  //console.log(receivers_list);
  jiff.emit('custom',receivers_list,mymsg,true);
  var ssid=1;
  if (jiff.id===1) {
    ssid=2;
  }
  jiff.listen('custom',function (ssid,msg) {

    //console.log('hh'+msg);
    msg=JSON.parse(msg);

    //var sid=msg['sender_id'];
    var my_choose=csecret[1]+','+csecret[2];

    var result=msg[my_choose];
    console.log('my json get'+my_choose+' '+result+' id'+jiff.id);



    var output_shares=GMW.gmw_jiff_share(jiff,result);
    console.log('output_share');

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();
    var allPromises = [];
    for (var k = 1; k <=Object.keys(output_shares).length; k++) {
      allPromises.push(GMW_OPEN.gmw_jiff_open(jiff,output_shares[k]));
      //  allPromises.push(output_shares[k].value);
    }

    Promise.all(allPromises).then(function (results) {
      console.log('open up in ot!',results);
      console.log(output_shares);
      jiff.disconnect(true, true);

      // final_deferred.resolve(results);

    });
    // return final_promise;

  });

}
*/
// if i>j
/*
function receive_OT(jiff,csecret) {
// ai,bi
  var my_choose=csecret[1]+','+csecret[2];
  var op;
  switch (my_choose) {
    case '0,0': op=0;break;
    case '0,1': op=1;break;
    case '1,0': op=2;break;
    case '1,1': op=3; break;
  }

  OT.receive(op, N).then(function (array) {
    var rec=ascii.to_ascii(array).split(':');
    var num=parseInt(rec[1]);
    //console.log('The chosen secret is:', num,'op=',op);
    return num;

  });

}
*/

function OT_option(cx,cy,i_shares) {
  var op=(cx&i_shares[1])^(cy&i_shares[0]);
  return op;
}

function OTGate(i_shares) {
  var opt1=OT_option(0,0,i_shares);
  var opt2=OT_option(0,1,i_shares);
  var opt3=OT_option(1,0,i_shares);
  var opt4=OT_option(1,1,i_shares);
  var re={};
  re['0,0:']=opt1;
  re['0,1:']=opt2;
  re['1,0:']=opt3;
  re['1,1:']=opt4;

  //console.log('my_ops',re);
  return re;
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
  gmw_and: gmw_and
};

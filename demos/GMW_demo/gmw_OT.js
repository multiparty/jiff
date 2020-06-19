/**
OT
**/
// csecret=={1:,2:}
const GMW=require('./gmw_share.js');
const GMW_OPEN=require('./gmw_open.js');
//const ascii = require('./ascii.js');
$ = require('jquery-deferred');
/*
 *  This is the setup for a secure 1-out-of-4 oblivious transfer using
 *  the methods in IO to send public messages between the two parties.
 */
// var IO = require('./io-template.js');
// const OT = require('1-out-of-n')(IO);
// const N = 4;

// party i :  receive aibj+ajbi from party j;
// get choose then ^aibi
// then share result to party i, j sxor to open

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
/*
    var wi= csecret[1]&csecret[2];
    var s=wi^num;
    console.log('re_ot',wi,s);
    //var shares= GMW.gmw_share(jiff,s);// receivlisst
    return s;
    */

// if i>j

//ssid: send OT msg to party_id list
function gmw_and(jiff,sec,sendls) {
  //console.log('v',csecret,jiff.id,ssid);
  var rels=[];
  var i;
  for ( i=1;i<=jiff.party_count;i++) {
    rels.push(i);
  }
  const p_id=jiff.id;
  var wi=sec[sendls[0]-1]&sec[sendls[1]-1];
  //console.log('fwi',wi,sec,'m1',sec[sendls[0]-1],'m2',sec[sendls[1]-1]);
  var csecret=[];

  for ( i=0;i<2;i++) {
    csecret.push(sec[sendls[i]-1]);
  }
  //console.log(csecret);
  // receivinglist of OT msg
  var recls=[];
  for (i=0;i<rels.length;i++) {
    if (rels[i]<p_id) {
      recls.push(rels[i]);
    }
  }

  var final_deferred = $.Deferred();
  var final_promise = final_deferred.promise();
  var four_opts=OTGate(csecret);// jason object
  four_opts['sender_id']=jiff.id;
  four_opts = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'open', four_opts], 2);
  var mymsg=JSON.stringify(four_opts);

  //console.log('send OT msg to ',recls,'msg=',mymsg);
  jiff.emit('OT',recls,mymsg,true);

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
  // }

  // for (j=1;j<jiff.id;j++) {
  //   jiff.listen('OT',function (j,msg) {
  //     w2=wi;
  //     msg=JSON.parse(msg);
  //     var my_choose=csecret[1]+','+csecret[2]+':';
  //     var result=msg[my_choose];
  //     //console.log('my json get'+my_choose+' id'+jiff.id,'result=',result);
  //     w2= w2^result;
  //     final_deferred.resolve(w2);
  //   });
  // }

  return final_promise;

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

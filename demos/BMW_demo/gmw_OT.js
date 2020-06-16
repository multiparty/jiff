/**
OT
**/

// csecret=={1:,2:}
const BMW=require('./bmw_share.js');
const BMW_OPEN=require('./bmw_open.js');
const ascii = require('./ascii.js');
/*
 *  This is the setup for a secure 1-out-of-3 oblivious transfer using
 *  the methods in IO to send public messages between the two parties.
 */
var IO = require('./io-example.js');
//const OT = require('./index.js')(IO);
const OT = require('1-out-of-n')(IO);
const N = 4;

// party i :  receive aibj+ajbi from party j;
// get choose then ^aibi
// then share result to party i, j ,c, sxor to open

// if i<j
function receive_OT(jiff,csecret) {
// ai,bi   // ai aj
  var my_choose=csecret[1]+','+csecret[2];
  //var ori_sum=csecret[1]&csecret[2];
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
    console.log('The chosen secret is:', num,'op=',op);
    var wi= csecret[1]&csecret[2];
    var s=wi^num;
    console.log('re_ot',wi,s);
    //var shares= BMW.bmw_share(jiff,s);// receivlisst
    //jiff.disconnect(true, true);
    return s;
  });

}

// if i>j

function send_opts(jiff,csecret) {
  const p_id=jiff.id;
  //four ops to send to party who should get

  const secrets = OTGate(csecret).map(ascii.to_array);
  OT.then(function (OT) {
    OT.send(secrets, N);
    var my_choose=csecret[1]+','+csecret[2];
    var op;
    switch (my_choose) {
      case '0,0': op=0;break;
      case '0,1': op=1;break;
      case '1,0': op=2;break;
      case '1,1': op=3;break;
    }

    console.log('op=',op,my_choose);
    OT.receive(op, N).then(function (array) {
      var rec=ascii.to_ascii(array).split(':');
      var num=parseInt(rec[1]);
      console.log('The chosen secret is:', num,'op=',op);//ascii.to_ascii(array)
      var shares=BMW.bmw_jiff_share(jiff,num);
      //var final_deferred = $.Deferred();
      //var final_promise = final_deferred.promise();
      var allPromises = [];
      for (var k = 1; k <=Object.keys(shares).length; k++) {
        allPromises.push(shares[k].value);
      }
      //return Promise.all(allPromises);
      Promise.all(allPromises).then(function ( v) {
        console.log('see',v[0],'kk',allPromises);
        jiff.disconnect(true, true);
      });

    });
    // end receive

  });

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



    var output_shares=BMW.bmw_jiff_share(jiff,result);
    console.log('output_share');

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

  });

  //bmw_constant_share(jiff, four_opts, threshold, receivers_list, senders_list, Zp, share_id);
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
  var re=[];
  // re.push(opt1);
  // re.push(opt2);
  // re.push(opt3);
  // re.push(opt4);
  re.push('0,0:'.concat(opt1));
  re.push('0,1:'.concat(opt2));
  re.push('1,0:'.concat(opt3));
  re.push('1,1:'.concat(opt4));
  console.log('my_ops',re);
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
  send_opts: send_opts,
//  bmw_jiff_share:bmw_jiff_share
};

    //var i;
    // for ( i=1;i<p_id;i++) {
    // }

    // send ops to
    // for ( i=p_id+1;i<=jiff.receivers_list.length;i++ ) {
    //   OT.send(secrets, N);
    // }
    // var wi= csecret[1]&csecret[2];
    // var s=wi^array;
    // console.log('re_ot',wi,s);

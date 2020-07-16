
/**
 * AND on two shares, return secret share of ci.
 * @function gmw_and
 * @param {module:jiff-client~JIFFClient} jiff - the jiff instance
 * @param {number} secret - the secret1 to share.
 * @param {number} secret - the secret2 to share.
 * @returns {object} a secret share of value ci
 */

var IO = require('./1-out-of-n/demo/numbers/IO.js');
const OT = require('./1-out-of-n/index.js')(IO);
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
    var share_id ;
    if (share_id==null) {
      share_id= jiff.counters.gen_op_id2('otshare', share1.holders, share1.holders);
    }
    var my_count=[];//list of promises needs to be resolve

    // generate OT msg
    const four_opts=OTGate(csecret);//eg.[0,1,1,0]

    // OT send process, send OT msg to small party_ids
    OT.then(function (OT) {
      for (var k=1;k<jiff.id;k++) {
        var my_opid=generate_op_id_ot(share_id,jiff.id,k);
        OT.send(four_opts,4,my_opid,jiff);

      }

      // receiving
      var choose=2*csecret[0]+csecret[1];// 0,1,2,3
      for ( var ssid=jiff.id+1;ssid<=jiff.party_count;ssid++) {
        var op=generate_op_id_ot(share_id,ssid,jiff.id);
        var mypromise=OT.receive(choose,4,op,jiff,null);//[unit8]
        my_count.push(mypromise);
      }

      //resolve
      Promise.all(my_count).then(function (v) {
        var re=wi;
        for (let i=0;i<v.length;i++) {
          re=re^v[i][0];
        }
        final_deferred.resolve(re);

      });

    });

    return final_promise;
  };

  return new share1.jiff.SecretShare(share1.when_both_ready(share2, ready), share1.holders, Math.max(share1.threshold, share2.threshold), share1.Zp);

}

/**
 * compute op_id for one OT
 * @function generate_op_id_ot
 * @param {String} share_id generated
 * @returns {number} OT msg's sender party Id
 * @returns {number} OT msg's receiver party Id
 */

function generate_op_id_ot(share_id,senderId,toPartyId) {
  var op_id=share_id+'-'+senderId+'-'+toPartyId;
  return op_id;
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


module.exports = {
  gmw_and: gmw_and
};

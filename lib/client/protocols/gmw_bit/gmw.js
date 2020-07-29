
module.exports = function (SecretShare) {
  /**
   * xor of two secret shares.
   * @method gmw_xor
   * @param {module:jiff-client~JIFFClient#SecretShare} share2 - the share to xor with this share.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result( ci=ai^bi).
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   *
   * @example
   * // share a value with all parties, and xor the values of two shares
   * var shares = jiff_instance.gmw_share(x);
   * var xor_re= shares[1].gmw_xor(shares[2]);
   * jiff_instance.gmw_open(xor_re);
   *
   */

  SecretShare.prototype.gmw_xor = function (share2) {
    if (!(this.jiff === share2.jiff)) {
      throw new Error('shares do not belong to the same instance (^)');
    }
    if (!this.jiff.helpers.Zp_equals(this, share2)) {
      throw new Error('shares must belong to the same field (^)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, share2.holders)) {
      throw new Error('shares must be held by the same parties (^)');
    }

    // XOR the two shares when ready locally
    var self = this;
    var ready = function () {
      var re=self.value ^ share2.value;
      return re;
    };
    // promise to execute ready_XOR when both are ready
    return new this.jiff.SecretShare(this.when_both_ready(share2, ready), this.holders, Math.max(this.threshold, share2.threshold), this.Zp);
  };

  /**
   * and of two secret shares.
   * @method gmw_and
   * @param {module:jiff-client~JIFFClient#SecretShare} share2 - the share to and with this share.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result( ci=ai&bi).
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   *
   * @example
   * // share a value with all parties, and xor the values of two shares
   * var shares = jiff_instance.gmw_share(x);
   * var xor_re= shares[1].gmw_xor(shares[2]);
   * var and_re= xor_re.gmw_and(shares[2]);
   * jiff_instance.gmw_open(and_re);
   *
   */
  SecretShare.prototype.gmw_and = function (share2) {
    if (!(this.jiff === share2.jiff)) {
      throw new Error('shares do not belong to the same instance (^)');
    }
    if (!(this.jiff.helpers.Zp_equals(this, share2)&& share2.Zp===2) ) {
      throw new Error('shares must belong to the same field and shares\'Zp must equals 2 (^)');
    }

    if (!this.jiff.helpers.array_equals(this.holders, share2.holders)) {
      throw new Error('shares must be held by the same parties (^)');
    }

    var self=this;
    // AND the two shares when ready
    var ready = function () {
      var jiff=self.jiff;
      var final_deferred = new jiff.helpers.Deferred();
      var final_promise = final_deferred.promise;
      var csecret=[];
      csecret.push(self.value);
      csecret.push(share2.value);
      var OT=jiff.OT;

      // receiving list of OT msg
      var share_id ;
      if (share_id==null) {
        share_id= jiff.counters.gen_op_id2('otshare', self.holders, self.holders);
      }
      var my_count=[];//list of promises needs to be resolve
      // generate OT msg
      const four_opts=OTGate(csecret);//eg.[0,1,1,0]
      // OT send process, send OT msg to small party_ids
      OT.then(function (OT) {
        for (var k=1;k<jiff.id;k++) {
          var my_opid=generate_op_id_ot(share_id,jiff.id,k);
          OT.send(four_opts,4,my_opid,null,jiff); // sending jiff as extra parameter in and function

        }

        // receiving
        var choose=2*csecret[0]+csecret[1];// 0,1,2,3
        for ( var ssid=jiff.id+1;ssid<=jiff.party_count;ssid++) {
          var op=generate_op_id_ot(share_id,ssid,jiff.id);
          var mypromise=OT.receive(choose,4,op,null,jiff);//[unit8]
          my_count.push(mypromise);
        }

        //resolve
        Promise.all(my_count).then(function (v) {
          var re=csecret[0]&csecret[1];//self.value & share2.value;
          for (let i=0;i<v.length;i++) {
            re=re^v[i][0];
          }
          final_deferred.resolve(re);

        });

      });

      return final_promise;
    };
    return new this.jiff.SecretShare(this.when_both_ready(share2, ready), this.holders, Math.max(this.threshold, share2.threshold), this.Zp);
  };

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
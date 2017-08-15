// The modulos to be used in secret sharing and operations on shares.
var gZp = 1299827;

// The length of RSA key in bits.
var RSA_bits = 1024;

// Randomly generate a string of size length
function random_string(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for(var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

// Mod instead of javascript's remainder (%)
function mod(x, y) {  
  if (x < 0) {
    return ((x%y)+y)%y; 
  }

  return x%y;
}

//Extended Euclead
function extended_gcd(a,b) { 
  if (b == 0)
    return [1, 0, a];
  
  temp = extended_gcd(b, a % b);
  x = temp[0];
  y = temp[1];
  d = temp[2];
  return [y, x-y*Math.floor(a/b), d];
}

// Compute the log to a given base (2 by default).
function bLog(value, base) {
  if(base == null) base = 2;
  return Math.log(value) / Math.log(base);
}

/*
 * Share given secret to the participating parties.
 *   jiff:      the jiff instance.
 *   secret:    the secret to share.
 *   Zp:        the modulos (if null global Zp will be used).
 *   op_id:     the operation id that matches this operation with received messages [optional].
 *   return:    a map (of size equal to the number of parties)
 *              where the key is the party id (from 1 to n)
 *              and the value is the share object that wraps
 *              the value sent from that party (the internal value maybe deferred).
 *
 */
function jiff_share(jiff, secret, Zp, op_id) {
  if(Zp == null) Zp = gZp;
  var party_count = jiff.party_count;
  var shares = jiff_compute_shares(secret, party_count, Zp);

  if(op_id == undefined) {
    op_id = "share" + jiff.share_op_count;
    jiff.share_op_count++;
  }

  jiff.deferreds[op_id] = {}; // setup a map of deferred for every received share

  var result = {};
  for(var i = 1; i <= party_count; i++) {
    if(i == jiff.id) { // Keep party's own share
      result[i] = new secret_share(jiff, true, null, shares[i], Zp);
      continue;
    }

    // receive share_i[id] from party i
    // check if the share is ready or not (maybe it was previously received)
    if(jiff.shares[op_id] == undefined || jiff.shares[op_id][i] == undefined) {
      // not ready, setup a deferred
      var deferred = $.Deferred();
      jiff.deferreds[op_id][i] = deferred;
      result[i] = new secret_share(jiff, false, deferred.promise(), undefined, Zp);
    }

    else {
      // ready, put value in secret share
      result[i] = new secret_share(jiff, true, null, jiff.shares[op_id][i], Zp);
      jiff.shares[op_id][i] = null;
    }

    // send encrypted shares_id[i] to party i
    var cipher_share = cryptico.encrypt(shares[i].toString(10), jiff.keymap[i]).cipher
    var msg = { party_id: i, share: cipher_share, op_id: op_id };
    jiff.socket.emit('share', JSON.stringify(msg));
  }

  return result;
}

/*
 * Compute the shares of the secret (as many shares as parties) using
 * a polynomial of degree: ceil(parties/2) - 1 (honest majority).
 *   secret:        the secret to share.
 *   party_count:   the number of parties.
 *   Zp:            the modulos.
 *   return:        a map between party number (from 1 to parties) and its
 *                  share, this means that (party number, share) is a
 *                  point from the polynomial.
 *
 */
function jiff_compute_shares(secret, party_count, Zp) {
  var shares = {}; // Keeps the shares

  // Each player's random polynomial f must have
  // degree t = ceil(n/2)-1, where n is the number of players
  // var t = Math.floor((party_count-1)/ 2);
  var t = party_count - 1;
  var polynomial = Array(t+1); // stores the coefficients

  // Each players's random polynomial f must be constructed
  // such that f(0) = secret
  polynomial[0] = secret;

  // Compute the random polynomial f's coefficients
  for(var i = 1; i <= t; i++) polynomial[i] = Math.floor(Math.random() * Zp);

  // Compute each players share such that share[i] = f(i)
  for(var i = 1; i <= party_count; i++) {
    shares[i] = polynomial[0];
    power = i;

    for(var j = 1; j < polynomial.length; j++) {
      shares[i] = mod((shares[i] + polynomial[j] * power), Zp);
      power = power * i;
    }
  }

  return shares;
}

/*
 * Store the received share and resolves the corresponding
 * deferred if needed.
 *   jiff:      the jiff instance.
 *   sender_id: the id of the sender.
 *   share:     the share.
 *   op_id:     the id of the share operation.
 *
 */
function receive_share(jiff, sender_id, share, op_id) {
  // Decrypt share
  if(sender_id != jiff.id)
    share = parseInt(cryptico.decrypt(share, jiff.secret_key).plaintext, 10);

  // Share is received before deferred was setup, store it.
  if(jiff.deferreds[op_id] == undefined) {
    if(jiff.shares[op_id] == undefined) {
      jiff.shares[op_id] = {}
    }

    jiff.shares[op_id][sender_id] = share;
    return;
  }

  // Deferred is already setup, resolve it.
  jiff.deferreds[op_id][sender_id].resolve(share);
  jiff.deferreds[op_id][sender_id] = null;
}

/*
 * Open up the given share to the participating parties.
 *   jiff:      the jiff instance.
 *   share:     the share of the secret to open that belongs to this party.
 *   parties:   an array with party ids (1 to n) of receiving parties [optional].
 *   op_id:     the operation id that matches this operation with received messages [optional].
 *   return:    a (JQuery) promise to the open value of the secret.
 *   throws:    error if share does not belong to the passed jiff instance.
 *
*/
function jiff_open(jiff, share, parties, op_id) {
  if(!(share.jiff === jiff)) throw "share does not belong to given instance";
  
  // Default values
  if(parties == null || parties == []) {
    parties = [];
    for(var i = 1; i <= jiff.party_count; i++)
      parties.push(i);
  }

  if(op_id == null) {
    op_id = "open" + jiff.open_op_count;
    jiff.open_op_count++;
  }

  // Check if this party is going to receive the result.
  var is_a_receiver = parties.indexOf(jiff.id) > -1;
  
  // Setup a deferred for receiving the shares from other parties
  var deferred;
  if(is_a_receiver) {
    deferred = $.Deferred();
    jiff.deferreds[op_id] = deferred;
  }

  // refresh/reshare, so that the original share remains secret, instead
  // a new share is sent/open without changing the actual value.
  share = share.refresh();
  
  // The given share has been computed, share it to all parties
  if(share.ready) jiff_broadcast(jiff, share, parties, op_id);

  // Share is not ready, setup sharing as a callback to its promise
  else share.promise.then(function() { jiff_broadcast(jiff, share, parties, op_id); }, share.error);

  // Defer accessing the shares until they are back
  return is_a_receiver ? deferred.promise() : null;
}

/*
 * Share the given share to all the parties in the jiff instance.
 *   jiff:      the jiff instance.
 *   share:     the share.
 *   parties:   the parties to broadcast the share to.
 *   op_id:     the id of the share operation.
 *
 */
function jiff_broadcast(jiff, share, parties, op_id) {
  for(var index = 0; index < parties.length; index++) {
    var i = parties[index]; // Party id
    if(i == jiff.id) { receive_open(jiff, i, share.value, op_id, share.Zp); continue; }

    // encrypt and send
    var cipher_share = cryptico.encrypt(share.value.toString(10), jiff.keymap[i]).cipher;
    var msg = { party_id: i, share: cipher_share, op_id: op_id, Zp: share.Zp };
    jiff.socket.emit('open', JSON.stringify(msg));
  }
}

/*
 * Store the received share of the secret to open, reconstruct
 * the secret and resolves the corresponding deferred if needed.
 *   jiff:      the jiff instance.
 *   sender_id: the id of the sender.
 *   share:     the share.
 *   op_id:     the id of the share operation.
 *   Zp:        the modulos.
 */
function receive_open(jiff, sender_id, share, op_id, Zp) {
  // ensure shares map exists
  if(jiff.shares[op_id] == undefined) {
    jiff.shares[op_id] = {}
  }

  // Decrypt share
  if(sender_id != jiff.id)
    share = parseInt(cryptico.decrypt(share, jiff.secret_key).plaintext, 10);

  // Save share
  jiff.shares[op_id][sender_id] = share;

  // Check if all shares were received
  var shares = jiff.shares[op_id];
  for(var i = 1; i <= jiff.party_count; i++)
    if(shares[i] == null) return;

  // Everything was received, resolve the deferred.
  jiff.deferreds[op_id].resolve(jiff_lagrange(shares, jiff.party_count, Zp));
  jiff.deferreds[op_id] = null;
  jiff.shares[op_id] = null;
}

/*
 * Uses Lagrange polynomials to interpolate the polynomial
 * described by the given shares (points).
 *   shares:        map between party id (x coordinate) and share (y coordinate).
 *   party_count:   number of parties (and shares).
 *   return:       the value of the polynomial at x=0 (the secret value).
 *
 */
function jiff_lagrange(shares, party_count, Zp) {
  var lagrange_coeff = Array(party_count+1);

  // Compute the Langrange coefficients at 0
  for(var i = 1; i <= party_count; i++) {
    lagrange_coeff[i] = 1;
    for(var j = 1; j <= party_count; j++) {
      if(j != i) lagrange_coeff[i] = lagrange_coeff[i] * (0 - j) / (i - j);
    }
  }

  // Reconstruct the secret via Lagrange interpolation
  var recons_secret = 0;
  for(var i = 1; i <= party_count; i++)
    recons_secret = mod((recons_secret + shares[i] * lagrange_coeff[i]), Zp);

  return recons_secret;
}

/*
 * Creates 3 shares, a share for every one of three numbers from a beaver triplet.
 * The server generates and sends the triplets on demand.
 *   jiff:      the jiff instance.
 *   Zp:        the modulos.
 *
 */
function jiff_triplet(jiff, Zp) {
  if(Zp == null) Zp = gZp;
  
  // Get the id of the triplet needed.
  var triplet_id = "triplet" + jiff.triplet_op_count;
  jiff.triplet_op_count++;
  
  // Send a request to the server.  
  jiff.triplets_socket.emit('triplet', JSON.stringify({triplet_id: triplet_id, Zp: Zp}));

  // Setup deferreds to handle receiving the triplets later.  
  var a_deferred = $.Deferred();
  var b_deferred = $.Deferred();
  var c_deferred = $.Deferred();
  jiff.deferreds[triplet_id] = { a: a_deferred, b: b_deferred, c: c_deferred };
  
  
  var a_share = new secret_share(jiff, false, a_deferred.promise(), undefined, Zp);
  var b_share = new secret_share(jiff, false, b_deferred.promise(), undefined, Zp);
  var c_share = new secret_share(jiff, false, c_deferred.promise(), undefined, Zp);  
  
  return [ a_share, b_share, c_share ];
} 

/*
 * Store the received beaver triplet and resolves the corresponding deferred.
 *   jiff:      the jiff instance.
 *   triplet_id:     the id of the triplet.
 *   triplet:   the triplet (object a -> share_a, b -> share_b, c -> share_c).
 *
 */
function receive_triplet(jiff, triplet_id, triplet) {
  // Decrypt shares
  var a = parseInt(cryptico.decrypt(triplet["a"], jiff.secret_key).plaintext, 10);
  var b = parseInt(cryptico.decrypt(triplet["b"], jiff.secret_key).plaintext, 10);
  var c = parseInt(cryptico.decrypt(triplet["c"], jiff.secret_key).plaintext, 10);

  // Deferred is already setup, resolve it.
  jiff.deferreds[triplet_id]["a"].resolve(a);
  jiff.deferreds[triplet_id]["b"].resolve(b);
  jiff.deferreds[triplet_id]["c"].resolve(c);
  jiff.deferreds[triplet_id] = null;
}

/**
 * Can be used to generate shares of a random number, or shares of zero.
 * For a random number, every party generates a local random number and secret share it,
 * then every party sums its share, resulting in a single share of an unknown random number for every party.
 * The same approach is followed for zero, but instead, all the parties know that the total number is zero, but they
 * do not know the value of any resulting share (except their own).
 *   jiff:    the jiff instance.
 *   n:       the number to share (random or zero or constant etc).
 *   Zp:      the modulos (if null then global Zp is used by default).
 */
function jiff_share_all_number(jiff, n, Zp) {
  if(Zp == null) Zp = gZp;
  var shares = jiff_share(jiff, n, Zp);
    
  var share = shares[1];
  for(var i = 2; i <= jiff.party_count; i++) {
    share = share.add(shares[i]);
  }
   
  return share;
}

/**
 * Use the server to generate shares for a random bit, zero, random non-zero number, or a random number.
 * The parties will not know the value of the number (unless the request is for shares of zero) nor other parties' shares.
 *   jiff:    the jiff instance.
 *   Zp:      the modulos (if null then global Zp is used by default).
 *   options: an object with these properties: { "zero": boolean, "bit": boolean, "nonzero": boolean, "max": number}
 */
function jiff_server_share_number(jiff, options, Zp) {
  if(Zp == null) Zp = gZp;
  
  // Get the id of the number.
  var number_id = "number" + jiff.number_op_count;
  jiff.number_op_count++;
  
  var msg = { number_id: number_id, Zp: Zp };
  msg = Object.assign(msg, options);
  
  // Send a request to the server.  
  jiff.numbers_socket.emit('number', JSON.stringify(msg));

  // Setup deferreds to handle receiving the triplets later.  
  var deferred = $.Deferred();
  jiff.deferreds[number_id] = deferred;
  
  var share = new secret_share(jiff, false, deferred.promise(), undefined, Zp);
  return share;
}

/*
 * Store the received share of a previously requested number from the server.
 *   jiff:      the jiff instance.
 *   number_id:     the id of the number.
 *   share:   the value of the share.
 *
 */
function receive_server_share_number(jiff, number_id, share) {
  // Decrypt received share.
  share = parseInt(cryptico.decrypt(share, jiff.secret_key).plaintext, 10);
  
  // Deferred is already setup, resolve it.
  jiff.deferreds[number_id].resolve(share);
  jiff.deferreds[number_id] = null;
}

 
/*
 * Create a new share.
 * A share is a value wrapper with a share object, it has a unique id
 * (per computation instance), and a pointer to the instance it belongs to.
 * A share also has methods for performing operations.
 *   jiff:      the jiff instance.
 *   ready:     whether the value of the share is ready or deferred.
 *   promise:   a promise to the value of the share.
 *   value:     the value of the share.
 *
 */
function secret_share(jiff, ready, promise, value, Zp) {
  var self = this;

  this.jiff = jiff;
  this.ready = ready;
  this.promise = promise;
  this.value = value;
  this.Zp = Zp;

  this.id = "share"+jiff.share_obj_count;
  jiff.share_obj_count++;

  // misc methods
  this.valueOf = function() {
    if(ready) return self.value;
    else return undefined;
  };

  this.toString = function() {
    if(ready) return self.id + ": " + self.value;
    else return self.id + ": <deferred>";
  };

  // helper for managing promises.
  this.error = function() { console.log("Error receiving " + self.toString); };
  this.receive_share = function(value) { self.value = value; self.ready = true; self.promise = null; };

  this.pick_promise = function(o) {
    if(self.ready && o.ready) return null;

    if(self.ready) return o.promise;
    else if(o.ready) return self.promise;
    else return Promise.all([self.promise, o.promise]);
  }
  
  // Reshares/refreshes the sharing of this number, used before opening to keep the share secret.
  this.refresh = function() {
    return self.add(self.jiff.server_generate_and_share({"zero": true}, self.Zp));
  };

  this.open = function(success, failure) {
    if(failure == null) failure = self.error;
    var promise = self.jiff.open(self);
    if(promise != null) promise.then(success, failure);
  }
  
  this.open_to = function(parties, success, failure) {
    if(failure == null) failure = self.error;
    var promise = self.jiff.open(self, parties);
    if(promise != null) promise.then(success, failure);
  }

  /* Addition with constant */
  this.add_cst = function(cst){
    if (!(typeof(cst) == "number")) throw "parameter should be a number";

    if(self.ready) // if share is ready
      return new secret_share(self.jiff, true, null, mod((self.value + cst), self.Zp), self.Zp);

    var promise = self.promise.then(function() { return mod((self.value + cst), self.Zp); }, self.error);
    return new secret_share(self.jiff, false, promise, undefined, self.Zp);
  }
  
  /* Subtraction with constant */
  this.sub_cst = function(cst){
    if (!(typeof(cst) == "number")) throw "parameter should be a number";

    if(self.ready) // if share is ready
      return new secret_share(self.jiff, true, null, mod((self.value - cst), self.Zp), self.Zp);

    var promise = self.promise.then(function() { return mod((self.value - cst), self.Zp); }, self.error);
    return new secret_share(self.jiff, false, promise, undefined, self.Zp);
  }

  /* Multiplication with constant */
  this.mult_cst = function(cst){
    if (!(typeof(cst) == "number")) throw "parameter should be a number";

    if(self.ready) // if share is ready
      return new secret_share(self.jiff, true, null, mod((self.value * cst), self.Zp), self.Zp);

    var promise = self.promise.then(function() { return mod((self.value * cst), self.Zp); }, self.error);
    return new secret_share(self.jiff, false, promise, undefined, self.Zp);
  }

  /* Addition */
  this.add = function(o) {
    if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance";
    if (!(o.Zp === self.Zp)) throw "shares must belong to the same field";

    // add the two shares when ready locally
    var ready_add = function() {
      return mod(self.value + o.value, self.Zp);
    }

    if(self.ready && o.ready) // both shares are ready
      return new secret_share(self.jiff, true, null, ready_add(), self.Zp);

    // promise to execute ready_add when both are ready
    var promise = self.pick_promise(o).then(ready_add, self.error);
    return new secret_share(self.jiff, false, promise, undefined, self.Zp);
  }
  
  /* subtraction */
  this.sub = function(o) {
    if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance";
    if (!(o.Zp === self.Zp)) throw "shares must belong to the same field";

    // add the two shares when ready locally
    var ready_sub = function() {
      return mod(self.value - o.value, self.Zp);
    }

    if(self.ready && o.ready) // both shares are ready
      return new secret_share(self.jiff, true, null, ready_sub(), self.Zp);

    // promise to execute ready_add when both are ready
    var promise = self.pick_promise(o).then(ready_sub, self.error);
    return new secret_share(self.jiff, false, promise, undefined, self.Zp);
  }
  
  /* multiplication via triplets */
  this.mult = function(o) {
    if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance";
    if (!(o.Zp === self.Zp)) throw "shares must belong to the same field";

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();
    var result = new secret_share(self.jiff, false, final_promise, undefined, self.Zp);
    
    // Get shares of triplets.
    var triplet = jiff.triplet(self.Zp);
    
    var a = triplet[0];
    var b = triplet[1];
    var c = triplet[2];
    
    // d = s - a. e = o - b.
    var d = self.add(a.mult_cst(-1));
    var e = o.add(b.mult_cst(-1));
    
    // Open d and e.
    // The only communication cost.
    var e_promise = self.jiff.open(e);
    var d_promise = self.jiff.open(d);
    Promise.all([e_promise, d_promise]).then(function(arr) {
      var e_open = arr[0];
      var d_open = arr[1];
      
      // result_share = d_open * e_open + d_open * b_share + e_open * a_share + c.
      var t1 = d_open * e_open;
      var t2 = b.mult_cst(d_open);
      var t3 = a.mult_cst(e_open);
      
      // All this happens locally.
      var final_result = t2.add_cst(t1);
      final_result = final_result.add(t3);
      final_result = final_result.add(c);      
      
      if(final_result.ready)
        final_deferred.resolve(final_result.value);
      else // Resolve the deferred when ready.
        final_result.promise.then(function () { final_deferred.resolve(final_result.value); });
    });
    
    return result;
  };
  
  this.xor = function(o) {
    if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance";
    if (!(o.Zp === self.Zp)) throw "shares must belong to the same field";
    
    return self.add(o).sub(self.mult(o).mult_cst(2));
  }
  
  this.xor_cst = function(o) {    
    return self.add_cst(o).sub(self.mult_cst(o).mult_cst(2));
  }

  /* comparison: negative number if self < o. 0 if self = i and positive number if self > o. */
  this.greater_or_equal = function(o, l) {
    if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance";
    if (!(o.Zp === self.Zp)) throw "shares must belong to the same field";
    
    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();
    var result = new secret_share(self.jiff, false, final_promise, undefined, self.Zp);
    
    var k = self.jiff.party_count;
    if(l == null) l = Math.floor(bLog(self.Zp, 2) - bLog(1 + Math.pow(2, k)) - 1);
    function preprocess() {      
      var assert = Math.pow(2, (l+2)) + Math.pow(2, (l+k));
      if(!(self.Zp > assert)) throw "field too small compared to security and bit length (" + assert + ")";

      var r_bits = [];
      for(var i = 0; i < l + k; i++)
        r_bits[i] = jiff_server_share_number(self.jiff, { "bit": true }, self.Zp);
           
      var r_modl = r_bits[0];
      for(var i = 1; i < l; i++)
        r_modl = r_modl.add(r_bits[i].mult_cst(Math.pow(2, i)));
        
      var r_full = r_modl;
      for(var i = l; i < l + k; i++)
        r_full = r_full.add(r_bits[i].mult_cst(Math.pow(2, i)));

      r_bits = r_bits.slice(0, l);
      
      var s_bit = jiff_server_share_number(self.jiff, { "bit": true }, self.Zp);
      var s_sign = s_bit.mult_cst(-2).add_cst(1);
      
      var mask = jiff_server_share_number(self.jiff, { "nonzero": true }, self.Zp);
      
      return { "s_bit": s_bit, "s_sign": s_sign, "mask": mask, "r_full": r_full, "r_modl": r_modl, "r_bits": r_bits };
    }
    
    function finish_compare(c, s_bit, s_sign, mask, r_modl, r_bits, z) {      
      var c_bits = [];
      for(var i = 0; i < l; i++)
        c_bits[i] = (c >> i) & 1;
        
      var sumXORs = [];
      for(var i = 0; i < l; i++)
        sumXORs[i] = 0;

      sumXORs[l-2] = r_bits[l-1].xor_cst(c_bits[l-1]).add_cst(sumXORs[l-1]);
      for(var i = l-3; i > -1; i--)
        sumXORs[i] = r_bits[i+1].xor_cst(c_bits[i+1]).add(sumXORs[i+1]);
            
      var E_tilde = [];
      for(var i = 0; i < r_bits.length; i++) {
        var e_i = r_bits[i].add_cst(-1 * c_bits[i]).add(s_sign);
        if(typeof(sumXORs[i]) != "number")
          e_i = e_i.add(sumXORs[i].mult_cst(3));
        else
          e_i = e_i.add_cst(3 * sumXORs[i]);
          
        E_tilde.push(e_i);
      }
              
      var product = mask;
      for(var i = 0; i < E_tilde.length; i++)
        product = product.mult(E_tilde[i]);

      product.open(function(product) {
        var non_zero = (product != 0) ? 1 : 0;
        var UF = s_bit.xor_cst(non_zero);
        var c_mod2l = mod(c, Math.pow(2, l));
        var res = UF.mult_cst(Math.pow(2, l)).sub(r_modl.add_cst(-1 * c_mod2l));
        
        var inverse = extended_gcd(Math.pow(2, l), self.Zp)[0];
        var final_result = z.sub(res).mult_cst(inverse);
        if(final_result.ready)
          final_deferred.resolve(final_result.value);
        else
          final_result.promise.then(function () { final_deferred.resolve(final_result.value); });
      });
    }
        
    function compare_online(preprocess) {
      var a = self.mult_cst(2).add_cst(1);
      var b = o.mult_cst(2);
      
      var z = a.sub(b).add_cst(Math.pow(2, l));
      var c = preprocess.r_full.add(z);
      c.open(function(c) { finish_compare(c, preprocess.s_bit, preprocess.s_sign, preprocess.mask, preprocess.r_modl, preprocess.r_bits, z); });
    }
    
    var pre = preprocess();
    compare_online(pre);
    
    return result;
  }

  // when the promise is resolved, acquire the value of the share and set ready to true
  if(!ready) this.promise.then(this.receive_share, this.error);
}

/*
 * Create a new jiff instance.
 *   hostname:        server hostname/ip and port.
 *   computation_id:  the id of the computation of this instance.
 *   party_count:     the number of parties in the computation (> 1).
 *   options:         javascript object with additonal options [optional]:
 *                      { "triplets_server": "http://hostname:port", 
 *                        "numbers_server": "http://hostname:port",
 *                        "keys_server": "http://hostname:port",
 *                        "party_id": num,
 *                        "secret_key": "skey for this party",
 *                        "public_keys": { 1: "key1", 2: "key2", ... } }
 *                    all parameters are optional, However, for keys to work all 
 *                    of "party_id", "secret_key", and "public_keys" should be provided.
 *   return:          the jiff instance for the described computation.
 *
 * The Jiff instance contains the socket, number of parties, functions
 * to share and perform operations, as well as synchronization flags.
 *
*/
function make_jiff(hostname, computation_id, party_count, options) {
  var jiff = { party_count: party_count, computation_id: computation_id, ready: false };

  // Setup sockets.
  jiff.socket = io(hostname);
  if(options == null || options.triplets_server == null || options.triplets_server == hostname)
    jiff.triplets_socket = jiff.socket;
  else
    jiff.triplets_socket = io(options.triplets_server);
    
  if(options == null || options.numbers_server == null || options.numbers_server == hostname)
    jiff.numbers_socket = jiff.socket;
  else
    jiff.numbers_socket = io(options.numbers_server);
    
  if(options != null && options.party_id != null && options.secret_key != null && options.public_keys != null) {
    jiff.id = options.party_id;
    jiff.secret_key = options.secret_key;
    jiff.public_key = options.public_keys[jiff.id];
    jiff.keymap = options.public_keys;
  }

  // Send the computation id to the server to receive proper
  // identification
  jiff.socket.emit("computation_id", JSON.stringify({ "computation_id": computation_id, "party_id": jiff.id }));

  jiff.share = function(secret, Zp) { return jiff_share(jiff, secret, Zp); };
  jiff.open = function(share, parties) { return jiff_open(jiff, share, parties); };
  jiff.triplet = function(Zp) { return jiff_triplet(jiff, Zp); };
  jiff.generate_and_share_random = function(Zp) { return jiff_share_all_number(jiff, Math.floor(Math.random() * Zp), Zp); };
  jiff.generate_and_share_zero = function(Zp) { return jiff_share_all_number(jiff, 0, Zp); };
  jiff.server_generate_and_share = function(options, Zp) { return jiff_server_share_number(jiff, options, Zp) };

  // Store the id when server sends it back
  jiff.socket.on('init', function(msg) {
    if(jiff.id == null) 
      jiff.id = parseInt(msg, 10);

    if(jiff.public_key == null) {
      // Size of the Passphrase used in generating an RSA key
      var passphrase_size = 25;
      jiff.secret_key = cryptico.generateRSAKey(random_string(passphrase_size), RSA_bits);
      jiff.public_key = cryptico.publicKeyString(jiff.secret_key);
    }
    
    jiff.socket.emit("public_key", jiff.public_key);
  });

  jiff.socket.on('public_key', function(msg) {
    if(jiff.keymap == null) 
      jiff.keymap = JSON.parse(msg);

    jiff.ready = true;
  });

  // Store sharing and shares counter which keeps track of the count of
  // sharing operations (share and open) and the total number of shares
  // respectively (used to get a unique id for each share operation and
  // share object).
  jiff.share_op_count = 0;
  jiff.open_op_count = 0;
  jiff.triplet_op_count = 0;
  jiff.number_op_count = 0;
  jiff.share_obj_count = 0;

  // Store a map from a sharing id (which share operation) to the
  // corresponding deferred and shares array.
  jiff.deferreds = {};
  jiff.shares = {};

  // Setup receiving matching shares
  jiff.socket.on('share', function(msg) {
    json_msg = JSON.parse(msg);

    sender_id = json_msg["party_id"];
    op_id = json_msg["op_id"];
    share = json_msg["share"];

    receive_share(jiff, sender_id, share, op_id);
  });

  jiff.socket.on('open', function(msg) {
    json_msg = JSON.parse(msg);

    sender_id = json_msg["party_id"];
    op_id = json_msg["op_id"];
    share = json_msg["share"];
    Zp = json_msg["Zp"];

    receive_open(jiff, sender_id, share, op_id, Zp);
  });
  
  jiff.triplets_socket.on('triplet', function(msg) {
    json_msg = JSON.parse(msg);

    triplet = json_msg["triplet"];
    triplet_id = json_msg["triplet_id"];

    receive_triplet(jiff, triplet_id, triplet);
  });
  
  jiff.numbers_socket.on('number', function(msg) {
    json_msg = JSON.parse(msg);

    number = json_msg["number"];
    number_id = json_msg["number_id"];

    receive_server_share_number(jiff, number_id, number);
  });
  
  jiff.socket.on('error', function(msg) {
    jiff.socket = null;
    jiff.ready = false;
    console.log(msg);
    throw msg;
  });

  return jiff;
}

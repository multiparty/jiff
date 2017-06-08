// The modulos to be used in secret sharing and operations on shares.
var Zp = 1031;//17; Math.pow(2, 31) - 1;

/*
 * Share given secret to the participating parties.
 *   jiff:      the jiff instance.
 *   secret:    the secret to share.
 *   return:    a map (of size equal to the number of parties)
 *              where the key is the party id (from 1 to n)
 *              and the value is the share object that wraps
 *              the value sent from that party (the internal value
 *              maybe deferred).
 *
 */
function jiff_share(jiff, secret) {
  var party_count = jiff.party_count;
  var shares = jiff_compute_shares(secret, party_count);

  var op_id = "share" + jiff.share_op_count;
  jiff.share_op_count++;
  jiff.deferreds[op_id] = {}; // setup a map of deferred for every received share

  var result = {};
  for(var i = 1; i <= party_count; i++) {
    if(i == jiff.id) { // Keep party's own share
      result[i] = new secret_share(jiff, true, null, shares[i]);
      continue;
    }

    // receive share_i[id] from party i
    // check if the share is ready or not (maybe it was previously received)
    if(jiff.shares[op_id] == undefined || jiff.shares[op_id][i] == undefined) {
      // not ready, setup a deferred
      var deferred = $.Deferred();
      jiff.deferreds[op_id][i] = deferred;
      result[i] = new secret_share(jiff, false, deferred.promise(), undefined);
    }

    else {
      // ready, put value in secret share
      result[i] = new secret_share(jiff, true, null, jiff.shares[op_id][i]);
      jiff.shares[op_id][i] = null;
    }

    // send shares_id[i] to party i
    var msg = { party_id: i, share: shares[i], op_id: op_id };
    jiff.socket.emit('share', JSON.stringify(msg));
  }

  return result;
}

/*
 * Compute the shares of the secret (as many shares as parties) using
 * a polynomial of degree: ceil(parties/2) - 1 (honest majority).
 *   secret:        the secret to share.
 *   party_count:   the number of parties.
 *   return:        a map between party number (from 1 to parties) and its
 *                  share, this means that (party number, share) is a
 *                  point from the polynomial.
 *
 */
function jiff_compute_shares(secret, party_count) {
  var shares = {}; // Keeps the shares

  // Each player's random polynomial f must have
  // degree t = ceil(n/2)-1, where n is the number of players
  var t = Math.floor((party_count-1)/ 2);

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
      shares[i] = (shares[i] + polynomial[j] * power) % Zp;
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
 *   return:    a (JQuery) promise to the open value of the secret.
 *   throws:    error if share does not belong to the passed jiff instance.
 *
*/
function jiff_open(jiff, share) {
  if(!(share.jiff === jiff)) throw "share does not belong to given instance";

  var count = jiff.party_count;
  var op_id = "open" + jiff.open_op_count;
  jiff.open_op_count++;

  // Setup a deferred for receiving the shares from other parties
  var deferred = $.Deferred();
  jiff.deferreds[op_id] = deferred;

  // The given share has been computed, share it to all parties
  if(share.ready) jiff_broadcast(jiff, share, op_id);

  // Share is not ready, setup sharing as a callback to its promise
  else share.promise.then(function() { jiff_broadcast(jiff, share, op_id); }, share.error);

  // Defer accessing the shares until they are back
  return deferred.promise();
}

/*
 * Share the given share to all the parties in the jiff instance.
 *   jiff:      the jiff instance.
 *   share:     the share.
 *   op_id:     the id of the share operation.
 *
 */
function jiff_broadcast(jiff, share, op_id) {
  for(var i = 1; i <= jiff.party_count; i++) {
    if(i == jiff.id) { receive_open(jiff, i, share.value, op_id); continue; }

    var msg = { party_id: i, share: share.value, op_id: op_id };
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
 *
 */
function receive_open(jiff, sender_id, share, op_id) {
    // ensure shares map exists
    if(jiff.shares[op_id] == undefined) {
      jiff.shares[op_id] = {}
    }

    // Update share
    jiff.shares[op_id][sender_id] = share;

    // Check if all shares were received
    var shares = jiff.shares[op_id];
    for(var i = 1; i <= jiff.party_count; i++)
      if(shares[i] == null) return;

    // Everything was received, resolve the deferred.
    jiff.deferreds[op_id].resolve(jiff_lagrange(shares, jiff.party_count));
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
function jiff_lagrange(shares, party_count) {
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
    recons_secret = (recons_secret + shares[i] * lagrange_coeff[i]) % Zp;

  return recons_secret;
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
function secret_share(jiff, ready, promise, value) {
  var self = this;

  this.jiff = jiff;
  this.ready = ready;
  this.promise = promise;
  this.value = value;

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

  this.open = function(success, failure) {
    jiff_instance.open(self).then(success, failure);
  }

  /* Addition */
  this.add = function(o) {
    if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance";
    
    // add the two shares when ready locally
    var ready_add = function() {
      return (o.value + self.value) % Zp;
    }

    if(self.ready && o.ready) // both shares are ready
      return new secret_share(self.jiff, true, null, ready_add());

    // promise to execute ready_add when both are ready
    var promise = self.pick_promise(o).then(ready_add, self.error);
    return new secret_share(self.jiff, false, promise, undefined);
  }

  this.add_cst = function(cst){
    if (!(typeof(cst) == "number")) throw "parameter should be a number";

    if(self.read) // if share is ready
      return new secret_share(self.jiff, true, null, (this.value + cst)%Zp);

    var promise = self.promise.then(function() { return (this.value + cst)%Zp; }, self.error);
    return new secret_share(self.jiff, false, promise, undefined);
  }

  this.mult_cst = function(cst){
    return new secret_share(self.jiff, true, null, this.value * cst);
  }

  /* multiplication */
  this.mult = function(o) {
    if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance";
    
    // multiplication has communication (multiple internal deferreds)
    // these deferred are chained inside ready_mult function
    // their chaining and number may variy
    // the last deferred resolves this deferred
    // such that the final numeric answer is passed into result
    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();
    var result = new secret_share(self.jiff, false, final_promise, undefined);
    
    // this function will be executed when self and o are ready
    var ready_mult = function() {
      // point-wise multiplication resulting in polynomial of higher degree
      var prod = (self.value * o.value) % Zp;
      var shares = self.jiff.share(prod);

      // get all the promises of the shares
      var promises = [];
      for(var i = 1; i <= self.jiff.party_count; i++)
      if(!shares[i].ready) promises.push(shares[i].promise);

      // recombine the shares received from every party (one share from every point-wise product)
      var recombine = function() {
        var values = {};
        for(var i = 1; i <= self.jiff.party_count; i++)
          values[i] = shares[i].value;

        return jiff_lagrange(values, self.jiff.party_count);
      };

      // either recombine directly or promise to when shares are ready
      // and chain the final answer into final_deferred so that 
      // the value is eventually stored in ``result'' share
      if(promises.length == 0) final_deferred.resolve(recombine());
      else Promise.all(promises).then(function() { final_deferred.resolve(recombine()); } , self.error);
    }
    
    if(self.ready && o.ready) // both shares are ready
      ready_mult();
      
    else // promise to execute ready_mult when both are ready
      self.pick_promise(o).then(ready_mult, self.error);    
    
    return result;
  }

  // less than
  this.less = function(o) {
    return self;
  }

  // when the promise is resolved, acquire the value of the share and set ready to true
  if(!ready) this.promise.then(this.receive_share, this.error);
}

/*
 * Create a new jiff instance.
 *   hostname:    server hostname/ip.
 *   port:        server port.
 *   party_count: the number of parties in the computation (> 1).
 *   return:      the jiff instance for the described computation.
 *
 * The Jiff instance contains the socket, number of parties, functions
 * to share and perform operations, as well as synchronization flags.
 *
*/
function make_jiff(hostname, port, party_count) {
  var jiff = { party_count: party_count, ready: false };

  jiff.socket = io(hostname+":"+port);
  jiff.share = function(secret) { return jiff_share(jiff, secret); };
  jiff.open = function(share) { return jiff_open(jiff, share); };

  // Store the id when server sends it back
  jiff.socket.on('init', function(msg) {
    jiff.id = parseInt(msg);
    jiff.ready = true;
  });

  // Store sharing and shares counter which keeps track of the count of
  // sharing operations (share and open) and the total number of shares
  // respectively (used to get a unique id for each share operation and
  // share object).
  jiff.share_op_count = 0;
  jiff.open_op_count = 0;
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

    receive_open(jiff, sender_id, share, op_id);
  });

  return jiff;
}

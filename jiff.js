// The modulos to be used in additive sharing.
var mod = Math.pow(2, 31) - 1;

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
  var count = jiff.party_count;
  var sum_mod = 0;
  var shares = {};
  var op_id = "share" + jiff.share_op_count;
  jiff.share_op_count++;

  // Compute first n-1 shares (random numbers)
  for(var i = 1; i < count; i++) {
    var share = Math.floor(Math.random() * mod);
    sum_mod = (sum_mod + share) % mod;
    shares[i] = share;
  }

  // Compute last share
  var share = (secret - sum_mod) % mod;
  if(share < 0) { share = share + mod; }
  shares[count] = share;

  // Setup a share object for receiving from each party and send each party its share
  var result_map = {};
  jiff.deferreds[op_id] = {};
  for(var i = 1; i <= count; i++) {
    // Keep party's own share ready
    if(i == jiff.id) {
      result_map[i] = new secret_share(jiff, true, null, shares[i]);
      continue;
    }
    
    // Check if the share is ready or not (maybe it was previously received)
    if(jiff.shares[op_id] == undefined || jiff.shares[op_id][i] == undefined) {
      // Not ready, setup a deferred
      var deferred = $.Deferred();
      jiff.deferreds[op_id][i] = deferred;
      result_map[i] = new secret_share(jiff, false, deferred.promise(), undefined);
    } else {
      // Ready, put value in secret share.
      result_map[i] = new secret_share(jiff, true, null, jiff.shares[op_id][i]);
      jiff.shares[op_id][i] = null;
    }
    
    var msg = { party_id: i, share: shares[i], op_id: op_id };
    jiff.socket.emit('share', JSON.stringify(msg));
  }

  // Defer accessing the shares until they are back
  return result_map;
}

/*
 * Opens up the given share to the participating parties.
 *   jiff:      the jiff instance.
 *   share:     the share of the secret to open that belongs to this party.
 *   return:    a (JQuery) promise to the open value of the secret.
 *   throws:    error if share does not belong to the passed jiff instance.
 *
*/
function jiff_open(jiff, share) {
  if(!(share.jiff === jiff)) throw "share does not belong to given instance";
  
  var count = jiff.party_count;
  var op_id = "open" + jiff.share_op_count;
  jiff.share_op_count++;

  // Setup a deffered for receiving the shares from other parties
  var deferred = $.Deferred();
  jiff.deferreds[op_id] = deferred;

  // The given share has been computed, share it to all parties
  if(share.ready) jiff_broadcast(jiff, share, op_id);
  
  // Share is not ready, setup sharing as a callback to its promise
  else {
    share.promise.then(function() { jiff_broadcast(jiff, share, op_id); }, share.error);
  }

  // Defer accessing the shares until they are back
  return deferred.promise();
}

/*
 * Shares the given share to all the parties in the jiff instance.
 *   jiff:      the jiff instance.
 *   share:     the share.
 *   op_id:     the id of the share operation.
 */
function jiff_broadcast(jiff, share, op_id) {
  for(var i = 1; i <= jiff.party_count; i++) {
    if(i == jiff.id) { receive_open(jiff, i, share.value, op_id); continue; }

    var msg = { party_id: i, share: share.value, op_id: op_id };
    jiff.socket.emit('open', JSON.stringify(msg));
  }
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
    var sum_mod = 0;
    for(var i = 1; i <= jiff.party_count; i++) {
      if(shares[i] == null) return;
      sum_mod = (sum_mod + shares[i]) % mod;
    }

    // Everything was received, resolve the deferred.
    jiff.deferreds[op_id].resolve(sum_mod);
    jiff.deferreds[op_id] = null;
    jiff.shares[op_id] = null;
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
  this.receive_share = function(value) { self.value = value; self.ready = ready; self.promise = null; };
  this.error = function() { console.log("Error receiving " + self.toString); };
  
  this.pick_promise = function(o) {
    if(self.ready && o.ready) return null;
  
    if(self.ready) return o.promise;
    else if(o.ready) return self.promise;
    else return Promise.all([self.promise, o.promise]);
  }
  
  // addition
  this.ready_add = function(o) {
    return (o.value + self.value) % mod;
  }
  
  this.add = function(o) {
    if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance"; 
    
    if(self.ready && o.ready) // both shares are ready
      return new secret_share(self.jiff, true, null, self.ready_add(o));
    
    var promise = self.pick_promise(o);    
    promise = promise.then(function() { return self.ready_add(o); }, self.error);
    return new secret_share(self.jiff, false, promise, undefined);
  }

  // multiplication
  this.mult = function(o) {
    return self;
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

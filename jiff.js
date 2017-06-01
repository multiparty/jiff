// The modulos to be used in additive sharing.
var mod = Math.pow(2, 31) - 1;

/*
 * Share given secret to the participating parties.
 *   jiff:    the jiff instance.
 *   secret:  the secret to share.
 *   return:  a (JQuery) promise to a map (of size equal to 
 *            the number of parties) where the key is the party 
 *            id (from 1 to n) and the value is the share it sent.
 *
*/
function jiff_share(jiff, secret) {
  var count = jiff.party_count;
  var sum_mod = 0;
  var shares = {};
  var share_id = "share" + jiff.share_count;  
  jiff.share_count++;
  
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
  
  // Setup a deffered for receiving the shares from other parties.
  var deferred = $.Deferred();
  jiff.deferreds[share_id] = deferred;
    
  // Shares have been computed, share them.
  for(var i = 1; i <= count; i++) {
    if(i == jiff.id) { receive_share(jiff, i, shares[i], share_id); continue; }
    
    var msg = { party_id: i, share: shares[i], share_id: share_id };
    jiff.socket.emit('share', JSON.stringify(msg));
  }
  
  // Defer accessing the shares until they are back
  return deferred.promise();
}

/*
 * Opens up the given share to the participating parties.
 *   jiff:    the jiff instance.
 *   share:   the share of the secret to open that belongs to this party.
 *   return:  a (JQuery) promise to the open value of the secret.
 *
*/
function jiff_open(jiff, share) {
  var count = jiff.party_count;
  var share_id = "open" + jiff.share_count;  
  jiff.share_count++;
    
  // Setup a deffered for receiving the shares from other parties.
  var deferred = $.Deferred();
  jiff.deferreds[share_id] = deferred;
    
  // Shares have been computed, share them.
  for(var i = 1; i <= count; i++) {
    if(i == jiff.id) { receive_open(jiff, i, share, share_id); continue; }
    
    var msg = { party_id: i, share: share, share_id: share_id };
    jiff.socket.emit('open', JSON.stringify(msg));
  }
  
  // Defer accessing the shares until they are back
  return deferred.promise();
}

/*
 * Store the received share and resolves the corresponding
 * deferred if needed.
 *   jiff:      the jiff instance.
 *   sender_id: the id of the sender.
 *   share:     the share.
 *   share_id:  the id of the share operation.
 *
 */
function receive_share(jiff, sender_id, share, share_id) {
    // ensure shares map exists
    if(jiff.shares[share_id] == null) {
      jiff.shares[share_id] = {}
    }

    // Update share
    jiff.shares[share_id][sender_id] = share;
    
    // Check if all shares were received
    var shares = jiff.shares[share_id];
    for(var i = 1; i <= jiff.party_count; i++) {
      if(shares[i] == null) return;
    }
    
    // Everything was received, resolve the deferred.
    jiff.deferreds[share_id].resolve(shares);
}

/*
 * Store the received share of the secret to open, reconstruct 
 * the secret and resolves the corresponding deferred if needed.
 *   jiff:      the jiff instance.
 *   sender_id: the id of the sender.
 *   share:     the share.
 *   share_id:  the id of the share operation.
 *
 */
function receive_open(jiff, sender_id, share, share_id) {
    // ensure shares map exists
    if(jiff.shares[share_id] == null) {
      jiff.shares[share_id] = {}
    }

    // Update share
    jiff.shares[share_id][sender_id] = share;
    
    // Check if all shares were received
    var shares = jiff.shares[share_id];
    var sum_mod = 0;
    for(var i = 1; i <= jiff.party_count; i++) {
      if(shares[i] == null) return;
      sum_mod = (sum_mod + shares[i]) % mod;
    }
    
    // Everything was received, resolve the deferred.
    jiff.deferreds[share_id].resolve(sum_mod);
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
function jiff(hostname, port, party_count) {
  var jiff = { party_count: party_count, ready: false};
  jiff.socket = io(hostname+":"+port);
  jiff.share = function(secret) { return jiff_share(jiff, secret); };
  jiff.open = function(share) { return jiff_open(jiff, share); };
  
  // Store the id when server sends it back
  jiff.socket.on('init', function(msg) {
    jiff.id = parseInt(msg);
    jiff.ready = true;
  });
  
  // Store share counter which keeps track of the count of sharing 
  // operations (used to get a unique id for each share operation).
  jiff.share_count = 0;
  
  // Store a map from a sharing id (which share operation) to the 
  // corresponding deferred and shares array.
  jiff.deferreds = {};
  jiff.shares = {};
  
  // Setup receiving matching shares
  jiff.socket.on('share', function(msg) {
    json_msg = JSON.parse(msg);
    
    sender_id = json_msg["party_id"];
    share_id = json_msg["share_id"];
    share = json_msg["share"];
    
    receive_share(jiff, sender_id, share, share_id);
  });
  
  jiff.socket.on('open', function(msg) {
    json_msg = JSON.parse(msg);
    
    sender_id = json_msg["party_id"];
    share_id = json_msg["share_id"];
    share = json_msg["share"];
    
    receive_open(jiff, sender_id, share, share_id);
  });
  
  return jiff;
}

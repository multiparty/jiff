# Hooks
Hooks can be passed to an instance at creation time through the options
```
var options = {};
options.hooks = {
  /* Example hooks */
  'beforeShare': function(instance, secret, threshold, receivers_list, senders_list, Zp) { /* some code */ return modified_secret; },
  'computeShares': function(secret, party_count, parties_list, threshold, Zp) { /* some code */ return shares_map; }
};
var instance = make_jiff('hostname', 'computation_id', options);
```

These are the possible hooks:
#### beforeShare[Array]: function(instance, secret, threshold, receivers_list, senders_list, Zp)
Initially, parameters are as passed to jiff.share in client code:
1. instance: the jiff instance
2. secret: the secret to share
3. threshold: the threshold for sharing
4. receivers_list: array of ids of receiving parties
5. senders_list: array of ids of sending parties (parties that have secrets)
6. Zp: the modulos

Return: must return the (possibly modified) secret to share, this is used as the secret for subsequent hooks in the array.

#### computeShares[Single]: function(instance, secret, parties_list, threshold, Zp)
1. instance: the jiff instance
2. secret: the secret to share
4. parties_list: array of ids of parties for which to create shares of the secret
3. threshold: the threshold for sharing
6. Zp: the modulos

Return: must return a map from party_id to its corresponding share value (for every party_id in parties_list).

#### afterComputeShare[Array]: function(instance, shares, threshold, receivers_list, senders_list, Zp)
1. instance: the jiff instance
2. shares: a map from party_id to the corresponding share value
3. threshold: the threshold for sharing
4. receivers_list: array of ids of receiving parties
5. senders_list: array of ids of sending parties (parties that have secrets)
6. Zp: the modulos

Return: must return a map from party_id to its corresponding share value (for every party_id in receivers_list).

#### encryptSign[Single]: function(message, encryption_public_key, signing_private_key, operation_type)
1. message: the message to encrypt (message type depends on operation type)
2. encryption_public_key: public key to encrypt with (corresponding to the receiving party)
3. signing_private_key: secret key to sign with (corresponding to this party)
4. operation_type: the operation for which this encryption is performed, one of the following: 'share', 'open', 'triplet', 'number'

Return: the signed cipher with any additional properties desired to be sent with it (tags, meta-info, etc) as a javascript object

#### decryptSign[Single]: function(cipher_text, decryption_secret_key, signing_public_key, operation_type)
1. cipher_text: the cipher_text to decrypt, the format and type matches that returned by encryptSign
2. decryption_secret_key: secret key to decrypt with (corresponding to this party)
3. signing_public_key: public key to verify signature with (corresponding to sending party)
4. operation_type: the operation for which this encryption is performed, one of the following: 'share', 'open', 'triplet', 'number'

Throw: if signature did not check out correctly
Return: the decrypted message, format and type must match that of the message passed to the corresponding encryptSign.

#### receiveShare[Array]: function(instance, sender_id, share)
1. instance: the jiff instance
2. sender_id: party_id of the sender
3. share: the received share (after decryption)

Return: the share (possibly modified), this is used as share for the subsequent hooks in the array.

#### beforeOpen[Array]: function(instance, share, parties)
1. instance: the jiff instance
2. share: the share to open {type: secret_share}
3. parties: the parties that will recieve the open

Return: the share to open (possibly modified), this is used as share for the subsequent hooks in the array.

#### receiveOpen[Array]: function(instance, sender_id, share, Zp)
1. instance: the jiff instance
2. sender_id: party_id of the sender
3. share: the received share (after decryption)
4. Zp: the modulos

Return: the share (possibly modified), this is used as share for the subsequent hooks in the array.

#### reconstructShare[Single]: function(instance, shares)
1. instance: the jiff instance
2. shares: a map from party_id to its corresponding object: { "value": share, "sender_id": sender_id, "Zp": Zp }

Return: the reconstructed secret.

#### afterReconstructShare[Array]: function(instance, value)
1. instance: the jiff instance
2. value: the reconstructed value as returned by reconstructShare

Return: the reconstructed secret (possibly modified), this is used as value for the subsequent hooks in the array.

#### receiveTriplet[Array]: function(instance, triplet)
1. instance: the jiff instance
2. triplet: the received triplet (after decryption), a map from 'a', 'b', 'c' to the corresponding shares, such that a*b = c

Return: the triplet (possibly modified), this is used as triplet for the subsequent hooks in the array.

#### receiveNumber[Array]: function(instance, number)
1. instance: the jiff instance
2. number: the received share (after decryption)

Return: the number share (possibly modified), this is used as number for the subsequent hooks in the array.

#### createSecretShare[Array]: function(instance, secret_share)
1. instance: the jiff instance
2. secret_share: the secret_share object as created by JIFF

Return: the secret_share object to be used by JIFF (possibly modified), this is used for the subsequent hooks in the array.




# Flows Supported By Hooks
Hooks allow to customize the following flows in JIFF without having to explicity modify JIFF's source code.

#### Share flow:
Determines how shares are generated and sent to parties:
(1) jiff.share -> (2) hook: beforeShare -> (3) hook: computeShare -> (4) hook: afterComputeShare -> (5) hook: encryptSign (operation_type = 'share') -> (6) send shares to parties -> (7) party receives share -> (8) hook: decryptSign (operation_type = 'share') -> (9) hook: receiveShare -> (10) resolve value into corresponding secret_share object.

The party may be receiving a share without sharing anything, in which case only steps (1) and (7) to (10) are executed.

The party may be sharing a value without receiving shares of anything, in which case only steps (1) to (6) are executed.

#### Open flow:
Determine show parties can open (reveal) a share and get the result:
(1) jiff.open/share.open -> (2) hook: beforeOpen -> (3) share is refreshed and refreshed value is used forward -> (4) hook: encryptSign (operation_type = 'open') -> (5) send share to parties -> (6) party receives share to open -> (7) hook: decryptSign (operation_type = 'open') -> (8) hook: receiveOpen ---[enough shares received]--> (9) hook: reconstructShare -> (10) hook: afterReconstructShare -> (11) resolve reconstructed value into open promise/callback.

Alternatively, a party may receive the result for a share that it does not own, in which case the flow becomes:
(1) jiff.receive_open -> step (6) in the flow above and onwards.

A party may also hold a share of the result but not receive the result, in which case only steps (1) to (5) of the original flow are executed.

#### Triplet request:
(1) jiff.triplet (e.g. when a multiplication is performed) -> (2) hook: encryptSign (operation_type = 'triplet') -> (3) request is sent to server -> (4) server replies -> (5) hook: decryptSign (operation_type = 'triplet') -> (6) hook: receiveTriplet -> (7) resolve triplet into corresponding secret_share objects.

#### Number request:
(1) jiff.server_generate_and_share (e.g. when a share refresh is performed) -> (2) hook: encryptSign (operation_type = 'number') -> (3) request is sent to server -> (4) server replies -> (5) hook: decryptSign (operation_type = 'number') -> (6) hook: receiveNumber -> (7) resolve triplet into corresponding secret_share objects.


#### Creation of secret_share objects:
This allows the user to modify the implementation of a secret_share, including changing how operations are implemented (e.g. addition, multiplication, etc), registering callbacks for when the share is computed, or adding additional operations. This is particularly useful when developing modules for JIFF.
(1) a share needs to be created (e.g. by jiff.share or by operating on shares) -> (2) new secret_share is called -> (3) the default secret_share object is created -> (4) hook: createSecretShare -> (5) returned secret_share object is used by JIFF.











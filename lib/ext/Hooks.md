# Hooks

## Supported Hooks

Hooks can be passed to an instance at creation time via an options object:
```javascript
var options = {};
options.hooks = {
  /* Example hooks. */
  'beforeShare': [
    function(instance, secret, threshold, receivers_list, senders_list, Zp) {
      /* Some code. */
      return modified_secret;
    } 
  ],
  'computeShares':
    function(secret, party_count, parties_list, threshold, Zp) {
      /* Some code. */
      return shares_map;
    }
};
var instance = make_jiff('hostname', 'computation_id', options);
```

Below we enumerate the possible hooks:

* `beforeShare[Array]: function(instance, secret, threshold, receivers_list, senders_list, Zp)`
  * Initially, parameters are as passed to `jiff_instance.share` in the client code:
    * `instance`: the JIFF instance
    * `secret`: the secret to share
    * `threshold`: the threshold for sharing
    * `receivers_list`: array of ids of receiving parties
    * `senders_list`: array of ids of sending parties (parties that have secrets)
    * `Zp`: the modulos
  * Return: must return the (possibly modified) secret to share (to be used as the secret for subsequent hooks in the array).
* `computeShares[Single]: function(instance, secret, parties_list, threshold, Zp)`
    * `instance`: the JIFF instance
    * `secret`: the secret to share
    * `parties_list`: array of ids of parties for which to create shares of the secret
    * `threshold`: the threshold for sharing
    * `Zp`: the modulus
  * Return: must return a map from `party_id` to its corresponding share value (for every `party_id` in `parties_list`).
* `afterComputeShare[Array]: function(instance, shares, threshold, receivers_list, senders_list, Zp)`
    * `instance`: the JIFF instance
    * `shares`: a map from party_id to the corresponding share value
    * `threshold`: the threshold for sharing
    * `receivers_list`: array of ids of receiving parties
    * `senders_list`: array of ids of sending parties (parties that have secrets)
    * `Zp`: the modulus
  * Return: must return a map from `party_id` to its corresponding share value (for every `party_id` in `receivers_list`).
* `encryptSign[Single]: function(message, encryption_public_key, signing_private_key, operation_type)`
    * ` message`: the message to encrypt (message type depends on operation type)
    * ` encryption_public_key`: public key to encrypt with (corresponding to the receiving party)
    * ` signing_private_key`: secret key to sign with (corresponding to this party)
    * ` operation_type`: the operation for which this encryption is performed, one of the following: 'share', 'open', 'triplet', 'number'
  * Return: the signed cipher with any additional properties desired to be sent with it (tags, meta-info, etc.) as a JavaScript object
* `decryptSign[Single]: function(cipher_text, decryption_secret_key, signing_public_key, operation_type)`
    * ` cipher_text`: the cipher_text to decrypt, the format and type matches that returned by encryptSign
    * ` decryption_secret_key`: secret key to decrypt with (corresponding to this party)
    * ` signing_public_key`: public key to verify signature with (corresponding to sending party)
    * ` operation_type`: the operation for which this encryption is performed, one of the following: 'share', 'open', 'triplet', 'number'
  * Throw: if signature did not check out correctly
  * Return: the decrypted message (format and type must match that of the message passed to the corresponding `encryptSign`).
* `receiveShare[Array]: function(instance, sender_id, share)`
    * ` instance`: the JIFF instance
    * ` sender_id`: party_id of the sender
    * ` share`: the received share (after decryption)
  * Return: the share, possibly modified (this is used as share for the subsequent hooks in the array).
* `beforeOpen[Array]: function(instance, share, parties)`
    * ` instance`: the JIFF instance
    * ` share`: the share to open {type: secret_share}
    * ` parties`: the parties that will receive the open
  * Return: the share to open, possibly modified (this is used as share for the subsequent hooks in the array).
* `receiveOpen[Array]: function(instance, sender_id, share, Zp)`
    * ` instance`: the JIFF instance
    * ` sender_id`: party_id of the sender
    * ` share`: the received share (after decryption)
    * ` Zp`: the modulus
  * Return: the share, possibly modified (this is used as share for the subsequent hooks in the array).
* `reconstructShare[Single]: function(instance, shares)`
    * ` instance`: the JIFF instance
    * ` shares`: a map from party_id to its corresponding object: `{"value":share, "sender_id":sender_id, "Zp":Zp }`
  * Return: the reconstructed secret.
* `afterReconstructShare[Array]: function(instance, value)`
    * ` instance`: the JIFF instance
    * ` value`: the reconstructed value as returned by reconstructShare
  * Return: the reconstructed secret, possibly modified (this is used as value for the subsequent hooks in the array).
* `receiveTriplet[Array]: function(instance, triplet)`
    * ` instance`: the JIFF instance
    * ` triplet`: the received triplet after decryption (a map from *a*, *b*, *c* to the corresponding shares such that *a* * *b* = *c*`)
  * Return: the triplet, possibly modified (this is used as triplet for the subsequent hooks in the array).
* `receiveNumbers[Array]: function(instance, numbers)`
    * `instance`: the JIFF instance
    * `numbers`: an array with format: [ {"number": {value}, "number_id": <string> } ] that contains number values (i.e. shares of numbers) and their ids (after decryption).
  * Return: an array with th same format as the numbers parameter: the values and ids inside it may be possibly modified (this is used as the numbers parameter for the subsequent hooks in the hook array).
* `createSecretShare[Array]: function(instance, secret_share)`
    * `instance`: the JIFF instance
    * `secret_share`: the secret_share object as created by JIFF
  * Return: the `secret_share` object to be used by JIFF, possibly modified (this is used for the subsequent hooks in the array).

## Flows Supported By Hooks

Hooks allow to customize the following flows in JIFF without having to explicity modify JIFF's source code.

### Share flow

Determines how shares are generated and sent to parties:

1. `jiff_instance.share`
2. hook: `beforeShare`
3. hook: `computeShare`
4. hook: `afterComputeShare`
5. hook: `encryptSign` (`operation_type` = `'share'`)
6. send shares to parties
7. party receives share
8. hook: `decryptSign` (`operation_type` = `'share'`)
9. hook: `receiveShare`
10. resolve value into corresponding `secret_share` object

Note that:
* the party may be receiving a share without sharing anything, in which case only steps 1 and 7-10 are executed;
* the party may be sharing a value without receiving shares of anything, in which case only steps 1-6 are executed.

### Open flow

Determine show parties can open (reveal) a share and get the result:

1. `jiff_instance.open/share.open`
2. hook: `beforeOpen`
3. share is refreshed and refreshed value is used going forward
4. hook: `encryptSign` (`operation_type` = `'open'`)
5. send share to parties
6. party receives share to open
7. hook: `decryptSign` (`operation_type` = `'open'`)
8. hook: `receiveOpen`
9. hook (once enough shares are received in step 8 above): `reconstructShare`
10. hook: `afterReconstructShare`
11. resolve reconstructed value into open promise/callback

Alternatively, a party may receive the result for a share that it does not own, in which case the flow becomes:

* `jiff_instance.receive_open`
* party receives share to open (step 6 from above sequence)
* steps 7-11 from above sequence

A party may also hold a share of the result but not receive the result, in which case only steps 1-5 of the original flow are executed.

### Triplet request

1. `jiff_instance.triplet` (e.g. when a multiplication is performed)
2. hook: `encryptSign` (`operation_type` = `'triplet'`)
3. request is sent to server
4. server replies
5. hook: `decryptSign` (`operation_type` = `'triplet'`)
6. hook: `receiveTriplet`
7. resolve triplet into corresponding `secret_share` objects

### Number request

1. `jiff_instance.server_generate_and_share` (e.g. when a share refresh is performed)
2. hook: `encryptSign` (`operation_type` = `'number'`)
3. request is sent to server
4. server replies
5. hook: `decryptSign` (`operation_type` = `'number'`)
6. hook: `receiveNumbers`
7. resolve triplet into corresponding `secret_share` objects

### Creation of secret_share objects

This flow is particularly useful when developing modules for JIFF. This allows the user to modify the implementation of a `secret_share` object, including changing how operations are implemented (e.g. addition, multiplication, etc.), registering callbacks for when the share is computed, or adding additional operations:

1. a share is created (e.g. by `jiff_instance.share` or by operating on shares)
2. `new secret_share` is invoked
3. the default `secret_share` object is created
4. hook: `createSecretShare`
5. returned `secret_share` object is used by JIFF

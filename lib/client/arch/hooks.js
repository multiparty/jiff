/**
 * The hooks for this instance.
 * Checkout the <a href="hooks.html">hooks documentation</a>
 * @see {@link module:jiff-client~JIFFClient#hooks}
 * @name hooks
 * @alias hooks
 * @namespace
 */

var crypto = require('../util/crypto.js');
var shamir_share = require('../protocols/shamir/share.js');
var shamir_open = require('../protocols/shamir/open.js');

function Hooks(jiffClient) {
  this.jiffClient = jiffClient;

  // avoid sharing aliases to the same array
  for (hook in Hooks.prototype) {
    if (Hooks.prototype.hasOwnProperty(hook) && typeof(Hooks.prototype[hook].length) === 'number' && Hooks.prototype[hook].slice) {
      this[hook] = Hooks.prototype[hook].slice();
    }
  }

  // fill in hooks from options
  var optionHooks = jiffClient.options.hooks || {};
  for (var hook in optionHooks) {
    if (hook === 'afterOperation') {
      this[hook] = optionHooks[hook].concat(this[hook]);
    } else if (optionHooks.hasOwnProperty(hook)) {
      this[hook] = optionHooks[hook];
    }
  }
}

/**
 * Hook for computing shares of a secret
 * @method computeShares
 * @memberof hooks
 * @param jiffClient {module:jiff-client~JIFFClient} - the jiff client instance
 * @param secret {number} - the secret to share
 * @param parties_list {number[]} - array of party ids to share with
 * @param threshold {number} - threshold of sharing
 * @param Zp {number} - the field prime
 */
Hooks.prototype.computeShares = shamir_share.jiff_compute_shares;
Hooks.prototype.reconstructShare = shamir_open.jiff_lagrange;

// Crypto hooks
Hooks.prototype.encryptSign = function (jiffClient, message) {
  if (jiffClient.sodium_ !== false) {
    return crypto.encrypt_and_sign.apply(null, arguments);
  } else {
    return message;
  }
};

Hooks.prototype.decryptSign = function (jiffClient, cipher) {
  if (jiffClient.sodium_ !== false) {
    return crypto.decrypt_and_sign.apply(null, arguments);
  } else {
    return cipher;
  }
};

Hooks.prototype.generateKeyPair = function (jiffClient) {
  if (jiffClient.sodium_ !== false) {
    var key = jiffClient.sodium_.crypto_box_keypair(); // this party's public and secret key
    return { public_key: key.publicKey, secret_key: key.privateKey }
  } else {
    return { public_key: '', secret_key: ''};
  }
};

Hooks.prototype.parseKey = function (jiffClient, keyString) {
  if (jiffClient.sodium_ !== false) {
    return new Uint8Array(JSON.parse(keyString));
  } else {
    return '';
  }
};

Hooks.prototype.dumpKey = function (jiffClient, key) {
  if (jiffClient.sodium_ !== false) {
    return '[' + key.toString() + ']';
  } else {
    return '';
  }
};

// Array Hooks
Hooks.prototype.beforeShare = [];
Hooks.prototype.afterComputeShare = [];
Hooks.prototype.receiveShare = [];

Hooks.prototype.beforeOpen = [];
Hooks.prototype.receiveOpen = [];
Hooks.prototype.afterReconstructShare = [];

Hooks.prototype.createSecretShare = [];

Hooks.prototype.beforeOperation = [];
Hooks.prototype.afterOperation = [
  // parse content of share/open messages to be integers (instead of strings due to encryption/decryption)
  function (jiff, label, msg) {
    if (label === 'share' || label === 'open') {
      msg['share'] = parseInt(msg['share'], 10);
    }
    return msg;
  }
];

/**
 * Execute all hooks attached to the given name in order.
 * Hooks are executed sequentially such that the first hook's return value is passed into the second and so on.
 * @method execute_array_hooks
 * @memberof hooks
 * @param {string} hook_name - the name of the hook
 * @param {Array} params - parameters to pass to the hooks
 * @param {number} acc_index - the index in params in which the result of the hooks must be saved, if no hooks
 *                             exist for the name, then params[acc_index] is returned.
 * @return {object} returns the result of the last hook.
 */
Hooks.prototype.execute_array_hooks = function (hook_name, params, acc_index) {
  var arr = this.jiffClient.hooks[hook_name];
  arr = (arr == null ? [] : arr);

  for (var i = 0; i < arr.length; i++) {
    params[acc_index] = arr[i].apply(this.jiffClient, params);
  }
  return params[acc_index];
};

module.exports = Hooks;
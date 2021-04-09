/**
 * JIFF Client.
 *
 * Exposes the constructor for the {@link module:jiff-client~JIFFClient} class.
 *
 * In the browser, this adds `JIFFClient` as a global identifier.
 *
 * In the browser, this can be accessed via:
 * <pre><code>
 *   &lt;script src="jiff-client.js"&gt;&lt;/script&gt;
 *   &lt;script type="text/javascript"&gt;
 *     var jiffClientInstance = new JIFFClient(hostname, computationId, options);
 *   &lt;/script&gt;
 * </code></pre>
 *
 * In node.js, this can be accessed via:
 * <pre><code>
 *   const JIFFClient = require('jiffClient');
 *   const jiffClientInstance = new JIFFClient(hostname, computationId, options);
 *
 * </code></pre>
 *
 * @module jiff-client
 * @alias jiff-client
 */

// browserify bundles this into our code bundle
var sodium = require('libsodium-wrappers');

// utils and helpers
var constants = require('./client/util/constants.js');
var helpers = require('./client/util/helpers.js');
var utils = require('./client/util/utils.js');
var linkedList = require('./common/linkedlist.js');

// hooks
var Hooks = require('./client/arch/hooks.js');

// extensions management
var extensions = require('./client/arch/extensions.js');

// op ids and other counters
var counters = require('./client/arch/counters.js');

// socket and events
var guardedSocket = require('./client/socket/mailbox.js');
var internalSocket = require('./client/socket/internal.js');
var socketEvents = require('./client/socket/events.js');

// handlers for communication
var handlers = require('./client/handlers.js');

// secret shares
var SecretShareMetaClass = require('./client/share.js');
var share_helpers = require('./client/shareHelpers.js');

// jiff client instance API
var api = require('./client/api.js');

// preprocessing
var preprocessingMap = require('./client/preprocessing/map.js');
var preprocessingAPI = require('./client/preprocessing/api.js');
var preprocessingDaemon = require('./client/preprocessing/daemon.js');

/**
 * Creates a new jiff client instance.
 * @class
 * @name JIFFClient
 * @param {!string} hostname - server hostname/ip and port.
 * @param {!string} computation_id - the id of the computation of this instance.
 * @param {?object} [options={}] - javascript object with additional options.
 *                           all parameters are optional, However, private and public key must either be both provided or neither of them provided.
 <pre>
 {
   "party_id": number,
   "party_count": number,
   "secret_key": Uint8Array to be used with libsodium-wrappers [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html},
   "public_key": Uint8Array to be used with libsodium-wrappers [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html},
   "public_keys": { 1: "Uint8Array PublicKey", 2: "Uint8Array PublicKey", ... },
   "Zp": default mod to use (prime number),
   "autoConnect": true/false,
   "hooks": { 'check out <a href="hooks.html">hooks documentation</a>' },
   "listeners" : A map from custom tags to listeners (of type function(sender_id, message_string)) that handle custom messages with that tag.
   "onConnect": function(jiff_instance),
   "onError": function(label, error): called when errors occured in client code or during handling requests from this client at the server side
                                      label is a string indicating where the error occured, and error is a string or an exception object.
   "safemod": boolean (whether or not to check if provided Zp is prime, may be slow for big primes, defaults to false),
   "crypto_provider": a boolean that flags whether to get beaver triplets and other preprocessing entities from the server (defaults to false),
   "socketOptions": an object, passed directly to socket.io constructor,
   "sodium": boolean, if false messages between clients will not be encrypted (useful for debugging),
   "maxInitializationRetries": how many consecutive times to retry to initialize with the server if initialization fails, defaults to 2,
   "preprocessingBatchSize": how many base level preprocessing tasks to execute in parallel.
 }
 </pre>
 *
 * @example
 * var JIFFClient = require('jiffClient'); // only for node.js
 * <script src="jiff-client.js"></script> // for the browser
 * // build a jiff instance which will connect to a server running on the local machine
 * var instance = new JIFFClient('http://localhost:8080', 'computation-1', {party_count: 2});
 */
function JIFFClient(hostname, computation_id, options) {
  var jiffClient = this;
  options = Object.assign({}, options);

  /**
   * The server hostname, ends with a slash, includes port and protocol (http/https).
   * @type {!string}
   */
  this.hostname = hostname.trim();
  if (!this.hostname.endsWith('/')) {
    this.hostname = this.hostname + '/';
  }

  /**
   * Stores the computation id.
   * @type {!string}
   */
  this.computation_id = computation_id;

  /**
   * Private. Do not use directly externally; use isReady() instead.
   * @type {!boolean}
   * @see {@link module:jiff-client~JIFFClient#isReady}
   */
  this.__ready = false;

  /**
   * Private. Do not use directly externally; use isInitialized() instead.
   * @type {!boolean}
   * @see {@link module:jiff-client~JIFFClient#isInitialized}
   */
  this.__initialized = false;

  /**
   * Returns whether this instance is capable of starting the computation.
   * In other words, the public keys for all parties and servers are known,
   * and this party successfully initialized with the server.
   * @returns {!boolean}
   */
  this.isReady = function () {
    return this.__ready;
  };

  /**
   * Returns whether this instance initialized successfully with the server.
   * Note that this can be true even when isReady() returns false, in case where some other parties have not
   * initialized yet!
   * @returns {!boolean}
   */
  this.isInitialized = function () {
    return this.__initialized;
  };

  /**
   * Helper functions [DO NOT MODIFY UNLESS YOU KNOW WHAT YOU ARE DOING].
   * @type {!helpers}
   */
  this.helpers = {};
  helpers(this);

  /**
   * Shallow copy of the options passed to the constructor.
   * @type {!Object}
   */

  this.options = options;


  // Parse and verify options
  options.maxInitializationRetries = options.maxInitializationRetries || constants.maxInitializationRetries;
  if (typeof(options.Zp) === 'number' && options.safemod !== false) { // big numbers are checked by extension
    if (!this.helpers.is_prime(options.Zp)) {
      throw new Error('Zp = ' + options.Zp + ' is not prime.  Please use a prime number for the modulus or set safemod to false.');
    }
  }

  /**
   * The default Zp for this instance.
   * @type {!number}
   */
  this.Zp = options.Zp || constants.gZp;

  /**
   * The id of this party.
   * @type {number}
   */
  this.id = options.party_id;

  /**
   * Total party count in the computation, parties will take ids between 1 to party_count (inclusive).
   * @type {number}
   */
  this.party_count = options.party_count;

  /**
   * sodium wrappers either imported via require (if in nodejs) or from the bundle (in the browser).
   * This will be false if options.sodium is false.
   * @see {@link https://www.npmjs.com/package/libsodium-wrappers}
   * @type {?sodium}
   */
  this.sodium_ = options.sodium !== false ? sodium : false;

  /**
   * A map from party id to public key. Where key is the party id (number), and
   * value is the public key, which by default follows libsodium's specs (Uint8Array).
   * @see {@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html}
   * @type {!object}
   */
  this.keymap = Object.assign({}, options.public_keys);

  /**
   * The secret key of this party, by default this follows libsodium's specs.
   * @see {@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html}
   * @type {?Uint8Array}
   */
  this.secret_key = options.secret_key;

  /**
   * The public key of this party, by default this follows libsodium's specs.
   * @see {@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html}
   * @type {?Uint8Array}
   */
  this.public_key = options.public_key;

  /**
   * Flags whether to use the server as a fallback for objects that were not pre-processed properly
   * @type {!boolean}
   */
  this.crypto_provider = (options.crypto_provider === true);

  /**
   * Stores messages that are received with a signature prior to acquiring the public keys of the sender.
   * { 'party_id': [ { 'label': 'share/open/custom', <other attributes of the message> } ] }
   * @type {object}
   */
  this.messagesWaitingKeys = {};

  /**
   * A map from tags to listeners (functions that take a sender_id and a string message).
   *
   * Stores listeners that are attached to this JIFF instance, listeners listen to custom messages sent by other parties.
   * @type {!object}
   */
  this.listeners = Object.assign({}, options.listeners);

  /**
   * Stores custom messages that are received before their listeners are set. Messages are stored in order.
   * { 'tag' => [ { "sender_id": <sender_id>, "message": <message> }, ... ] }
   *
   * Once a listener has been set, the corresponding messages are sent to it in order.
   * @type {!object}
   */
  this.custom_messages_mailbox = {};

  /**
   * Stores all promises created within some barrier.
   * @type {!object}
   */
  this.barriers = {};

  /**
   * Stores the parties and callbacks for every .wait_for() registered by the user.
   * @type {!Array}
   */
  this.wait_callbacks = [];

  /**
   * Counts how many times JIFF attempted to initialize with the server
   * without success consecutively.
   * @type {!number}
   *
   */
  this.initialization_counter = 0;

  /**
   * Utility functions
   * @type {!utils}
   */
  this.utils = {};
  utils(this);

  /**
   * An array containing the names (jiff-client-[name].js) of the extensions that are
   * applied to this instance.
   * @type {string[]}
   */
  this.extensions = ['base'];

  /**
   * Internal helpers for operations inside/on a share. Modify existing helpers or add more in your extensions
   * to avoid having to re-write and duplicate the code for primitives.
   * @type {!object}
   */
  this.share_helpers = share_helpers;

  /**
   * The constructor function used by JIFF to create a new share. This can be overloaded by extensions to create custom shares.
   * Modifying this will modify how shares are generated in the BASE JIFF implementation.
   * A share is a value/promise wrapped with a share object.
   * A share also has methods for performing operations.
   * @constructor
   * @param {number|promise} value - the value of the share, or a promise to it.
   * @param {Array} holders - the parties that hold all the corresponding shares (must be sorted).
   * @param {number} threshold - the min number of parties needed to reconstruct the secret.
   * @param {number} Zp - the mod under which this share was created.
   *
   * @example
   * // A share whose value is 10: the secret is still unknown, 10 is only one share
   * var share = new jiffClient.SecretShare(10, [1, 2, 3], 3, jiffClient.Zp);
   *
   * @example
   * // A share whose value depends on some promise
   * var share = new jiffClient.SecretShare(promise, [1, 2, 3, 4], 4, jiffClient.Zp);
   */
  this.SecretShare = SecretShareMetaClass(this);

  /**
   * A collection of useful protocols to be used during computation or preprocessing: extensions are encouraged to add useful
   * common protocols here, under a sub namespace corresponding to the extension name.
   * @type {!protocols}
   */
  this.protocols = {};

  /**
   * A collection of useful protocols for manipulating bitwise shared numbers, and transforming them from and to regular numeric shares.
   * @member {!bits} bits
   * @memberof protocols
   */
  this.protocols.bits = {};

  /**
   * Stores pre-computed values (beaver triples, random bits, etc) used to aid/speed up the main processes.
   * @type {!object}
   */
  this.preprocessing_table = {};

  /**
   * Sets batch size for base level preprocessing tasks
   * @type {!Number}
   */
  this.preprocessingBatchSize = options.preprocessingBatchSize || 10;

  /**
   * maps all primitive operations to the other operations they are dependent on, until leaves are primitives for which preprocessing protocols are defined,
   * this map is traversed during preprocessing to guide preprocessing of high level operations. Extensions should modify this map to reflect
   * any required changes to preprocessing of modified primitives
   * @type {!object}
   */
  this.preprocessing_function_map = {};

  /**
   * Store the default preprocessing protocols for each type of preprocessing value
   * @type {!object}
   */
  this.default_preprocessing_protocols = {};

  /**
   * Stores currently executing preprocessing tasks.
   * @type {!linkedlist}
   */
  this.currentPreprocessingTasks = linkedList();

  /**
   * Callback to execute when preprocessing is done!
   * @type {?function}
   */
  this.preprocessingCallback = null;

  /**
   * Used for logging/debugging
   * @type {!Array}
   */
  this.logs = [];

  /**
   * A map from open operation id to the corresponding shares received for that open operation
   * @type {!object}
   */
  this.shares = {};

  /**
   * A map from some message operation id to a deferred resolved when that message is received.
   * @type {!object}
   */
  this.deferreds = {};

  /**
   * Store sharing and shares counter which keeps track of the count of
   * sharing operations (share and open) and the total number of shares
   * respectively (used to get a unique id for each share operation and
   * share object).
   * @type {!object}
   */
  this.counters = {};

  /**
   * A prefix attached to all op_ids, can be changed using {@link module:jiff-client~JIFFClient#seed_ids}
   * to guarantee uniqueness of auto generate ids in a user-side callback
   * or event handler.
   * @type {string}
   * @see {@link module:jiff-client~JIFFClient#seed_ids}
   */
  this.op_id_seed = '';

  /**
   * The hooks for this instance.
   * Checkout the <a href="hooks.html">hooks documentation</a>
   * @type {!hooks}
   */
  this.hooks = new Hooks(this);

  /**
   * Contains handlers for communication events
   * @type {!handlers}
   */
  this.handlers = {};

  // Add user facing API
  api(this);

  // Preprocessing
  preprocessingMap(this);
  preprocessingAPI(this);
  preprocessingDaemon(this);

  // set up counters for op_ids
  counters(this);


  this.socketConnect = function (JIFFClientInstance) {

    if (options.__internal_socket == null) {
      /**
       * Socket wrapper between this instance and the server, based on sockets.io
       * @type {!GuardedSocket}
       */
      JIFFClientInstance.socket = guardedSocket(JIFFClientInstance);
    } else {
      JIFFClientInstance.socket = internalSocket(JIFFClientInstance, options.__internal_socket);
    }

    // set up socket event handlers
    handlers(JIFFClientInstance);

    JIFFClientInstance.initSocket();


    JIFFClientInstance.socket.connect();
  }

  /**
   * Connect to the server and starts listening.
   */
  this.connect = function () {
    // Ask socket to connect, which will automatically trigger a call to 'initialize()' when connection is established!

    // Wait to let JIFF know that we are connected until sodium is ready
    // Trigger the onConnect call
    var JIFFClientInstance = this;
    if (jiffClient.sodium_ === false) {
      JIFFClientInstance.socketConnect(JIFFClientInstance);
    } else {
      jiffClient.sodium_.ready.then(function () {
        JIFFClientInstance.socketConnect(JIFFClientInstance);
      });
    }
  };

  // Connect when all is done
  if (options.autoConnect !== false) {
    this.connect();
  }
}


// Add socket event handlers to prototype
socketEvents(JIFFClient);

// Add extension management to prototype
extensions(JIFFClient);

// export JIFFClient class
module.exports = JIFFClient;

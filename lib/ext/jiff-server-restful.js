var LARGE = Math.pow(2, 32);

module.exports = {
  name: 'restAPI',
  make_jiff: function (base_instance, options) {
    var jiff = base_instance;

    if (options == null) {
      options = {};
    }

    // options parsing
    var app = options.app;
    if (app == null) {
      return;
    }

    var maxBatchSize = (options.maxBatchSize == null) ? 150 : options.maxBatchSize;
    if (options.routes == null) {
      options.routes = {};
    }

    // restAPI specific maps
    jiff.restful = {};
    jiff.restful.maps = {
      tags: {}, // { computation_id -> { party_id -> lastTag } }
      pendingMessages: {} // { computation_id -> { party_id -> { tag: tag, ptr: ptr } } }
    };

    // Hooks to initialize maps at the right position in the life cycle
    var oldInitComputation = jiff.initComputation;
    var oldFreeComputation = jiff.freeComputation;

    jiff.initComputation = function (computation_id, party_id, party_count) {
      oldInitComputation.apply(jiff, arguments);

      if (jiff.restful.maps.tags[computation_id] == null) {
        jiff.restful.maps.tags[computation_id] = {};
        jiff.restful.maps.pendingMessages[computation_id] = {};
      }

      if (jiff.restful.maps.tags[computation_id][party_id] == null) {
        jiff.restful.maps.tags[computation_id][party_id] = 0;
      }
    };

    jiff.freeComputation = function (computation_id) {
      oldFreeComputation.apply(jiff, arguments);
      delete jiff.restful.maps.tags[computation_id];
      delete jiff.restful.maps.pendingMessages[computation_id];
    };

    // handle received operations as you would with their socket equivalent
    jiff.restful.handlers = {
      share: jiff.handlers.share,
      open: jiff.handlers.open,
      custom: jiff.handlers.custom,
      crypto_provider: jiff.handlers.crypto_provider,
      free: jiff.handlers.free
    };

    // Functionality managing mailboxes
    jiff.restful.dumpMailbox = function (computation_id, party_id) {
      var mailbox = jiff.hooks.getFromMailbox(jiff, computation_id, party_id);
      if (mailbox.length === 0) {
        return { messages: [] };
      }

      var messages = [];
      var count = Math.min(mailbox.length, maxBatchSize);
      for (var i = 0; i < count; i++) {
        var letter = mailbox[i];
        messages.push({ label: letter.label, payload: letter.msg });
      }

      // come up with unique tag
      var tag = (jiff.restful.maps.tags[computation_id][party_id] + 1) % LARGE;
      jiff.restful.maps.tags[computation_id][party_id] = tag;
      jiff.restful.maps.pendingMessages[computation_id][party_id] = { tag: tag, store_id: mailbox[count - 1].id };

      return { ack: tag, messages: messages };
    };
    jiff.restful.freeTag = function (computation_id, party_id, tag) {
      if (tag != null && jiff.restful.maps.pendingMessages[computation_id] != null && jiff.restful.maps.pendingMessages[computation_id][party_id] != null) {
        var pending = jiff.restful.maps.pendingMessages[computation_id][party_id];
        if (tag === pending.tag) {
          jiff.hooks.sliceMailbox(jiff, computation_id, party_id, pending.store_id);
          jiff.restful.maps.pendingMessages[computation_id][party_id] = null;
        }
      }
    };

    // Helpers used within the '/poll' route
    jiff.restful.initializeParty = function (msg) {
      var initialization = msg['initialization'];
      if (initialization == null) {
        if (msg['from_id'] == null) {
          return { success: false, error: 'cannot determine party id' };
        }
        return { success: true, initialization: null, party_id: msg['from_id'] };
      }

      var output = jiff.handlers.initializeParty(msg['computation_id'], initialization['party_id'], initialization['party_count'], initialization, false);
      if (!output.success) {
        return output;
      }

      output['party_id'] = output.message.party_id;
      output['message'] = JSON.stringify(output['message']);
      return output;
    };
    jiff.restful.handleMessage = function (computation_id, from_id, messages) {
      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        var label = message['label'];
        var payload = message['payload'];

        // Make sure label is legal
        if (jiff.restful.handlers[label] == null) {
          return { success: false, label: label, error: 'Unrecognized label' };
        }

        // handle message
        var output = jiff.restful.handlers[label](computation_id, from_id, payload);

        // Terminate on error
        if (!output.success) {
          return { success: false, label: label, error: output.error };
        }
      }
      return { success: true };
    };

    // REST API routes

    // Initialization route, assigns calling party an id and party_count, registers
    // the party in the computation, handles any authentication through hooks.
    //
    // Requests content include:
    // 1. computation_id: must be specified.
    // 2. from_id: should be specified, unless initialization is provided, in which case this field is ignored.
    // 3. initialization: if provided, this means the party is attempting to initialize first, this object contains:
    //    a. party_id: if provided, it indicates the party is requesting to be assigned this id.
    //    b. party_count: if provided, it indicates the party expects this number of parties.
    //    c. public_key: as per crypto hooks.
    //    d. any additional authentication information attached by extensions and handled by server hooks.
    // 4. messages: list of messages (maybe empty), each is a single operation (share, open, etc) with form
    //    { label: <operation label>, payload: <operation content> } where operation content has the same
    //    format as the socket equivalent operation payload.
    // 5. ack: an ack tag indicating the last received group of messages by this party.
    // 6. any additional information (perhaps for authentication?) that are attached by extensions for the server hooks.
    //    authentication extensions / custom hooks must take care to reconcile between information provided here and
    //    inside initialization (if any).
    //
    // Responses are json object including the following attributes:
    // 1. success: true if initialization is successful, false otherwise.
    // 2. error: if success is false, this contains a text description of the error.
    // 3. initialization: provided if initialization was provided in the request.
    //    a. party_id, party_count, public_keys map.
    //    b. any additional authentication information attached by server hooks.
    // 4. messages: list of messages that are stored in the mailbox for this party.
    // 5. tag: a numeric tag to be acknowledged in future requests, if messages is empty, this will be undefined,
    //         and does not need to be acknowledged.
    // 6. any additional information attached by hooks / extensions.
    app.post('/poll', function (req, res) {
      var msg = req.body;

      // Execute start hooks
      try {
        msg = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'poll', msg['computation_id'],  msg['from_id'], msg], 4);
      } catch (err) {
        return res.json({ success: false, label: 'poll', error: typeof(err) === 'string' ? err : err.message });
      }

      // First: attempt to initialize if needed.
      var output = jiff.restful.initializeParty(msg);
      if (!output.success) { // failed to initialize
        return res.json({ success: false, label: 'initialization', error: output.error });
      }

      // Initialization successful: read parameters and construct response!
      var response = { success: true, initialization: output.message };
      var computation_id = msg['computation_id'];
      var from_id = output.party_id;

      // Second: free acknowledged tag.
      jiff.restful.freeTag(computation_id, from_id, msg['ack']);

      // Third: handle given messages / operations.
      output = jiff.restful.handleMessage(computation_id, from_id, msg.messages);
      if (!output.success) {
        return res.json(output);
      }

      // Fourth: dump mailbox and encrypt.
      var dumped = jiff.restful.dumpMailbox(computation_id, from_id);
      response = Object.assign(response, dumped);

      // Execute end hooks
      response = jiff.hooks.execute_array_hooks('afterOperation', [jiff, 'poll', computation_id, from_id, response], 4);

      // Respond back!
      res.json(response);
    });
  }
};

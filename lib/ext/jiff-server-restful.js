var LARGE = Math.pow(2, 32);

module.exports = {
  name: 'restful',
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

    // restAPI specific maps
    jiff.restful = {};
    jiff.restful.keys_changed = {};
    jiff.restful.tags = {}; // { computation_id -> { party_id -> lastTag } }
    jiff.restful.pending_messages = {}; // { computation_id -> { party_id -> { tag: tag, ptr: ptr } } }

    // Hooks
    jiff.hooks.afterInitialize.push(function (jiff, computation_id, party_id, party_count, msg, return_message) {
      if (jiff.restful.keys_changed[computation_id] == null) {
        jiff.restful.keys_changed[computation_id] = {};
      }
      if (jiff.restful.tags[computation_id] == null) {
        jiff.restful.tags[computation_id] = {};
      }

      jiff.restful.keys_changed[computation_id][party_id] = false;
      if (jiff.restful.tags[computation_id][party_id] == null) {
        jiff.restful.tags[computation_id][party_id] = 0;
      }

      return return_message;
    });

    jiff.hooks.afterPublicKey.push(function (jiff, computation_id, party_id, msg, return_message) {
      if (jiff.restful.keys_changed[computation_id] != null) {
        for (var key in jiff.restful.keys_changed[computation_id]) {
          if (jiff.restful.keys_changed[computation_id].hasOwnProperty(key)) {
            jiff.restful.keys_changed[computation_id][key] = return_message;
          }
        }
      }

      return return_message;
    });

    jiff.hooks.afterFree.push(function (jiff, computation_id) {
      delete jiff.restful.keys_changed[computation_id];
      delete jiff.restful.tags[computation_id];
      delete jiff.restful.pending_messages[computation_id];
    });

    // Functionality managing mailboxes and keys
    jiff.restful.dump_publickeys = function (computation_id, party_id) {
      if (jiff.restful.keys_changed[computation_id] == null || jiff.restful.keys_changed[computation_id][party_id] == null
        || jiff.restful.keys_changed[computation_id][party_id] === false) {
        return null;
      }

      var keymap_to_send = jiff.restful.keys_changed[computation_id][party_id];
      jiff.restful.keys_changed[computation_id][party_id] = false;
      jiff.hooks.put_in_mailbox(jiff, 'public_key', JSON.stringify(keymap_to_send), computation_id, party_id);
    };
    jiff.restful.dump_mailbox = function (computation_id, party_id) {
      jiff.restful.dump_publickeys(computation_id, party_id);

      var mailbox = jiff.hooks.get_mailbox(jiff, computation_id, party_id);
      if (mailbox.length === 0) {
        return { messages: [] };
      }

      var messages = [];
      for (var i = 0; i < mailbox.length; i++) {
        var letter = mailbox[i];
        messages.push({ label: letter.label, msg: letter.msg });
      }

      // come up with unique tag
      var tag = (jiff.restful.tags[computation_id][party_id] + 1) % LARGE;
      jiff.restful.tags[computation_id][party_id] = tag;
      jiff.restful.pending_messages[computation_id][party_id] = { tag: tag, store_id: mailbox[mailbox.length-1].id };

      return { tag: tag, messages: messages};
    };
    jiff.restful.free_tag = function (computation_id, party_id, tag, msg) {
      try {
        jiff.execute_array_hooks('beforeOperation', [jiff, 'ack', computation_id, party_id, msg], 4);
      } catch (err) {
        return { success: false, error: typeof(err) === 'string' ? err : err.message };
      }

      if (tag != null && jiff.restful.pending_messages[computation_id] != null && jiff.restful.pending_messages[computation_id][party_id] != null) {
        var pending = jiff.restful.pending_messages[computation_id][party_id];
        if (tag === pending.tag) {
          jiff.hooks.slice_mailbox(jiff, computation_id, party_id, pending.store_id);
          jiff.restful.pending_messages[computation_id][party_id] = null;
        }
      }

      return { success: true, message: jiff.execute_array_hooks('beforeOperation', [jiff, 'ack', computation_id, party_id, {}], 4) };
    };
    jiff.restful.poll = function (computation_id, party_id, msg) {
      try {
        jiff.execute_array_hooks('beforeOperation', [jiff, 'poll', computation_id, party_id, msg], 4);
      } catch (err) {
        return { success: false, error: typeof(err) === 'string' ? err : err.message };
      }

      msg = jiff.restful.dump_mailbox(computation_id, party_id);

      msg = jiff.execute_array_hooks('afterOperation', [jiff, 'poll', computation_id, party_id, msg], 4);

      return { success: true, message: msg };
    };

    // REST API routes
    app.post('/computation_id', function (req, res) {
      var msg = req.body;

      // read message
      var computation_id = msg['computation_id'];
      var party_id = msg['party_id'];
      var party_count = msg['party_count'];

      var output = jiff.initializeParty(computation_id, party_id, party_count, msg);
      if (output.success) {
        res.send(200).json({ success: true, message: output.message});
      } else {
        res.send(200).json({ success: false, error: output.error });
      }
    });

    app.post('/public_key', function (req, res) {
      var packet = req.body;
      var computation_id = packet['computation_id'];
      var from_id = packet['from_id'];
      var msg = packet['msg'];

      var result = jiff.public_key(computation_id, from_id, msg);
      if (!result.success) {
        res.status.json({ success: false, error: result.error });
      } else {
        result = jiff.restful.poll(computation_id, from_id, msg);
        if (result.success) {
          res.status(200).json({ success: true, message: result.message });
        } else {
          res.status(200).json({ success: false, error: result.error });
        }
      }
    });

    app.post('/share', function (req, res) {
      var packet = req.body;
      var computation_id = packet['computation_id'];
      var from_id = packet['from_id'];
      var msg = packet['msg'];

      var output = jiff.share(computation_id, from_id, msg);
      if (!output.success) {
        res.status(200).json({ success: false, error: output.error });
      } else {
        var result = jiff.restful.poll(computation_id, from_id, msg);
        res.status(200).json(result);
      }
    });

    app.post('/open', function (req, res) {
      var packet = req.body;
      var computation_id = packet['computation_id'];
      var from_id = packet['from_id'];
      var msg = packet['msg'];

      var output = jiff.open(computation_id, from_id, msg);
      if (!output.success) {
        res.status(200).json({ success: false, error: output.error });
      } else {
        var result = jiff.restful.poll(computation_id, from_id, msg);
        res.status(200).json(result);
      }
    });

    app.post('/custom', function (req, res) {
      var packet = req.body;
      var computation_id = packet['computation_id'];
      var from_id = packet['from_id'];
      var msg = packet['msg'];

      var output = jiff.custom(computation_id, from_id, msg);
      if (!output.success) {
        res.status(200).json({ success: false, error: output.error });
      } else {
        var result = jiff.restful.poll(computation_id, from_id, msg);
        res.status(200).json(result);
      }
    });

    app.post('/triplet', function (req, res) {
      var packet = req.body;
      var computation_id = packet['computation_id'];
      var from_id = packet['from_id'];
      var msg = packet['msg'];

      var output = jiff.triplet(computation_id, from_id, msg);

      var result;
      if (output.success) {
        jiff.hooks.put_in_mailbox(jiff, 'triplet', output.message, computation_id, from_id);
        result = jiff.restful.poll(computation_id, from_id, msg);
      } else {
        result = { success: false, error: output.error };
      }
      res.status(200).json(result);
    });

    app.post('/number', function (req, res) {
      var packet = req.body;
      var computation_id = packet['computation_id'];
      var from_id = packet['from_id'];
      var msg = packet['msg'];

      var output = jiff.number(computation_id, from_id, msg);

      var result;
      if (output.success) {
        jiff.hooks.put_in_mailbox(jiff, 'number', output.message, computation_id, from_id);
        result = jiff.restful.poll(computation_id, from_id, msg);
      } else {
        result = { success: false, error: output.error };
      }

      res.status(200).json(result);
    });

    // Rest specific routes: one for polling and one for acknowledging receipt of messages.
    app.post('/poll', function (req, res) {
      var packet = req.body;
      var computation_id = packet['computation_id'];
      var from_id = packet['from_id'];
      var msg = packet['msg']; // usually empty, but use for support of customized messages (e.g. authentication)

      var result = jiff.restful.poll(computation_id, from_id, msg);
      res.status(200).json(result);
    });

    app.post('/ack', function (req, res) {
      var packet = req.body;
      var computation_id = packet['computation_id'];
      var from_id = packet['from_id'];
      var tag = packet['tag'];
      var msg = packet['msg']; // usually empty, but use for support of customized messages (e.g. authentication)

      var output = jiff.restful.free_tag(computation_id, from_id, tag, msg);
      if (output.success) {
        res.status(200).json({success: true, messages: []});
      } else {
        res.status(200).json({success: false, error: output.error });
      }
    });

    app.post('/free', function (req, res) {
      var packet = req.body;
      var computation_id = packet['computation_id'];
      var from_id = packet['from_id'];
      var msg = packet['msg']; // usually empty, but use for support of customized messages (e.g. authentication)

      var output = jiff.free(computation_id, from_id, msg);
      if (output.success) {
        res.status(200).json({ success: true, messages: []});
      } else {
        res.status(200).json({ success: false, error: output.error});
      }
    });

    return jiff;
  }
};

var LARGE = Math.pow(2, 32);

module.exports = {
  name: 'restful',
  make_jiff: function (base_instance, options) {
    var jiff = base_instance;

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
    var old_public_key = jiff.public_key;
    var old_free = jiff.free;
    jiff.public_key = function (computation_id, party_id, msg) {
      if (jiff.restful.keys_changed[computation_id] != null) {
        for (var key in jiff.restful.keys_changed[computation_id]) {
          if (jiff.restful.keys_changed[computation_id].hasOwnProperty(key)) {
            jiff.restful.keys_changed[computation_id][key] = true;
          }
        }
      }

      return old_public_key(computation_id, party_id, msg);
    };
    jiff.free = function (computation_id) {
      old_free(computation_id);
      delete jiff.restful.keys_changed[computation_id];
      delete jiff.restful.tags[computation_id];
      delete jiff.restful.pending_messages[computation_id];
    };

    // Functionality managing mailboxes and keys
    jiff.restful.publickeys = function (computation_id, party_id) {
      if (jiff.restful.keys_changed[computation_id] != null && jiff.restful.keys_changed[computation_id][party_id] === true) {
        return null;
      }

      jiff.restful.keys_changed[computation_id][party_id] = false;

      // Gather and format keys
      var keymap_to_send = {};
      for (var key in jiff.key_map[computation_id]) {
        if (jiff.key_map[computation_id].hasOwnProperty(key)) {
          keymap_to_send[key] = jiff.hooks.dumpKey(jiff.key_map[computation_id][key]);
        }
      }

      jiff.hooks.put_in_mailbox('public_key', JSON.stringify(keymap_to_send), computation_id, party_id);
    };
    jiff.restful.dump_mailbox = function (computation_id, party_id) {
      var mailbox = jiff.hooks.get_mailbox(computation_id, party_id);
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
    jiff.restful.free_tag = function (computation_id, party_id, tag) {
      if (tag == null || jiff.restful.pending_messages[computation_id] == null || jiff.restful.pending_messages[computation_id][party_id]  == null) {
        return;
      }

      var pending = jiff.restful.pending_messages[computation_id][party_id];
      if (tag === pending.tag) {
        jiff.hooks.slice_mailbox(computation_id, party_id, pending.store_id);
        jiff.restful.pending_messages[computation_id][party_id] = null;
      }
    };
    jiff.restful.poll = function (computation_id, party_id) {
      jiff.restful.publickeys(computation_id, party_id);
      var response = jiff.restful.dump_mailbox(computation_id, party_id);
      response['success'] = true;
      return response;
    };

    // REST API routes
    app.post('/computation_id', function (req, res) {
      var msg = req.body;

      // read message
      var computation_id = msg['computation_id'];
      var party_id = msg['party_id'];
      var party_count = msg['party_count'];

      var output = jiff.initializeParty(computation_id, party_id, party_count, null);
      if (output.success) {
        if (jiff.restful.keys_changed[computation_id] == null) {
          jiff.restful.keys_changed[computation_id] = {};
        }
        if (jiff.restful.tags[computation_id] == null) {
          jiff.restful.tags[computation_id] = null;
        }

        jiff.restful.keys_changed[computation_id][output.msg.party_id] = false;
        if (jiff.restful.tags[computation_id][party_id] == null) {
          jiff.restful.tags[computation_id][party_id] = 0;
        }
        res.send(200).json({ success: true, message: output.message});
      } else {
        res.send(200).json({ success: false, error: output.error });
      }
    });

    app.post('/public_key', function (req, res) {
      var packet = req.body;
      jiff.public_key(packet.computation_id, packet.from_id, packet.msg);

      var result = jiff.restful.poll(packet.computation_id, packet.from_id);
      if (result.success) {
        jiff.restful.keys_changed[packet.computation_id][packet.from_id] = false; // TODO what if we do not receive this? client side must keep trying
        res.status(200).json({ success: true, message: result.message });
      } else {
        res.status(200).json({ success: false, error: result.error });
      }
    });

    app.post('/share', function (req, res) {
      var packet = req.body;
      var output = jiff.share(packet.computation_id, packet.from_id, packet.msg);
      if (!output.success) {
        res.status(200).json({ success: false, error: output.error });
      } else {
        var result = jiff.restful.poll(packet.computation_id, packet.from_id);
        res.status(200).json(result);
      }
    });

    app.post('/open', function (req, res) {
      var packet = req.body;
      var output = jiff.open(packet.computation_id, packet.from_id, packet.msg);
      if (!output.success) {
        res.status(200).json({ success: false, error: output.error });
      } else {
        var result = jiff.restful.poll(packet.computation_id, packet.from_id);
        res.status(200).json(result);
      }
    });

    app.post('/custom', function (req, res) {
      var packet = req.body;
      var output = jiff.number(packet.computation_id, packet.from_id, packet.msg);
      if (!output.success) {
        res.status(200).json({ success: false, error: output.error });
      } else {
        var result = jiff.restful.poll(packet.computation_id, packet.from_id);
        res.status(200).json(result);
      }
    });

    app.post('/triplet', function (req, res) {
      var packet = req.body;
      var computation_id = packet.computation_id;
      var party_id = packet.party_id;
      var msg = packet.msg;

      var output = jiff.triplet(computation_id, party_id, msg);

      var result;
      if (output.success) {
        jiff.hooks.put_in_mailbox('triplet', output.message, computation_id, party_id);
        result = jiff.restful.poll(packet.computation_id, packet.from_id);
      } else {
        result = { success: false, error: output.error };
      }
      res.status(200).json(result);
    });

    app.post('/number', function (req, res) {
      var packet = req.body;
      var computation_id = packet.computation_id;
      var party_id = packet.party_id;
      var msg = packet.msg;

      var output = jiff.number(computation_id, party_id, msg);

      var result;
      if (output.success) {
        jiff.hooks.put_in_mailbox('number', output.message, computation_id, party_id);
        result = jiff.restful.poll(packet.computation_id, packet.from_id);
      } else {
        result = { success: false, error: output.error };
      }

      res.status(200).json(result);
    });

    // Rest specific routes: one for polling and one for acknowledging receipt of messages.
    app.post('/poll', function (req, res) {
      var packet = req.body;
      var result = jiff.restful.poll(packet.computation_id, packet.from_id);
      res.status(200).json(result);
    });

    app.post('/ack', function (req, res) {
      var packet = req.body;
      jiff.restful.free_tag(packet.computation_id, packet.from_id, packet.tag);
      res.status(200).json({ success: true, messages: []});
    });

    return jiff;
  }
};

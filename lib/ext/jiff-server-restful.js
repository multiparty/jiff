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
          keymap_to_send[key] = '[' + jiff.key_map[computation_id][key].toString() + ']';
        }
      }

      jiff.put_in_mailbox('public_key', JSON.stringify(keymap_to_send), computation_id, party_id);
    };
    jiff.restful.encode_mailbox = function (computation_id, party_id) {
      var messages = [];
      if (jiff.mailbox[computation_id] == null || jiff.mailbox[computation_id][party_id] == null || jiff.mailbox[computation_id][party_id].head == null) {
        return { messages: [] };
      }

      var mailbox = jiff.mailbox[computation_id][party_id];
      var current = mailbox.head;
      var prev = null;
      while (current != null) {
        prev = current;
        messages.push(current.object);
        current = current.next();
      }

      // come up with unique tag
      var tag = (jiff.restful.tags[computation_id][party_id] + 1) % LARGE;
      jiff.restful.tags[computation_id] = tag;
      jiff.restful.pending_messages[computation_id][party_id] = [tag, prev];

      return { tag: tag, messages: messages};
    };
    jiff.restful.slice_mailbox = function (computation_id, party_id, tag) {
      if (tag == null || jiff.mailbox[computation_id] == null || jiff.mailbox[computation_id][party_id] == null
          || jiff.restful.pending_messages[computation_id] == null || jiff.restful.pending_messages[computation_id][party_id]  == null) {
        return;
      }

      var to_remove = jiff.restful.pending_messages[computation_id][party_id];
      if (tag === to_remove.tag) {
        jiff.mailbox[computation_id][party_id].slice(to_remove.ptr);
        jiff.restful.pending_messages[computation_id][party_id] = null;
      }
    };
    jiff.restful.poll = function (computation_id, party_id) {
      jiff.restful.publickeys(computation_id, party_id);
      return jiff.restful.encode_mailbox(computation_id, party_id);
    };

    // REST API routes
    app.post('/computation_id', function (req, res) {
      // START OF REST API SPECIFIC SETUP
      var msg = req.body;

      // read message
      var computation_id = msg['computation_id'];
      var party_id = msg['party_id'];
      var party_count = msg['party_count'];
      // END OF REST API SPECIFIC SETUP

      // COMPUTATION: independent from socket
      var output = jiff.initializeParty(computation_id, party_id, party_count, null);
      if (output.label === 'init') {
        if (jiff.restful.keys_changed[computation_id] == null) {
          jiff.restful.keys_changed[computation_id] = {};
        }
        if (jiff.restful.tags[computation_id] == null) {
          jiff.restful.tags[computation_id] = null;
        }
        jiff.restful.keys_changed[computation_id][output.msg.party_id] = false;
        if (jiff.restful.tags[computation_id] == null) {
          jiff.restful.tags[computation_id] = 0;
        }
      }
      // END OF COMPUTATION

      // START OF SOCKET SPECIFIC OUTPUT/CLEANUP
      res.send(JSON.stringify(output));
      // END OF SOCKET SPECIFIC OUTPUT/CLEANUP
    });

    app.post('/public_key', function (req, res) {
      var packet = req.body;
      jiff.public_key(packet.computation_id, packet.from_id, packet.msg);

      var result = jiff.restful.poll(packet.computation_id, packet.from_id);
      res.status(200).json(result);

      jiff.restful.keys_changed[packet.computation_id][packet.from_id] = false;
    });

    app.post('/share', function (req, res) {
      var packet = req.body;
      jiff.share(packet.computation_id, packet.from_id, packet.msg);

      var result = jiff.restful.poll(packet.computation_id, packet.from_id);
      res.status(200).json(result);
    });

    app.post('/open', function (req, res) {
      var packet = req.body;
      jiff.open(packet.computation_id, packet.from_id, packet.msg);

      var result = jiff.restful.poll(packet.computation_id, packet.from_id);
      res.status(200).json(result);
    });

    app.post('/custom', function (req, res) {
      var packet = req.body;
      jiff.number(packet.computation_id, packet.from_id, packet.msg);

      var result = jiff.restful.poll(packet.computation_id, packet.from_id);
      res.status(200).json(result);
    });

    app.post('/triplet', function (req, res) {
      var packet = req.body;
      var computation_id = packet.computation_id;
      var party_id = packet.party_id;
      var msg = packet.msg;

      var output = jiff.triplet(computation_id, party_id, msg);
      jiff.put_in_mailbox(output.label, output.message, computation_id, party_id);

      var result = jiff.restful.poll(packet.computation_id, packet.from_id);
      res.status(200).json(result);
    });

    app.post('/number', function (req, res) {
      var packet = req.body;
      var computation_id = packet.computation_id;
      var party_id = packet.party_id;
      var msg = packet.msg;

      var output = jiff.number(computation_id, party_id, msg);
      jiff.put_in_mailbox(output.label, output.message, computation_id, party_id);

      var result = jiff.restful.poll(packet.computation_id, packet.from_id);
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
      jiff.restful.slice_mailbox(packet.computation_id, packet.from_id, packet.tag);
      res.status(200).json({ messages: []});
    });

    return jiff;
  }
};

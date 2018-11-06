module.exports = {
  name: 'restful',
  make_jiff: function (base_instance, options) {
    var jiff = base_instance;

    var app = options.app;
    if (app == null) {
      return;
    }

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
      // END OF COMPUTATION

      // START OF SOCKET SPECIFIC OUTPUT/CLEANUP
      res.send(JSON.stringify(output));
      // END OF SOCKET SPECIFIC OUTPUT/CLEANUP
    });

    app.post('/share', function (req, res) {
      var packet = req.body;
      jiff.share(packet.computation_id, packet.from_id, packet.msg);
      res.send('ok');
    });

    app.post('/open', function (req, res) {
      var packet = req.body;
      jiff.open(packet.computation_id, packet.from_id, packet.msg);
      res.send('ok');
    });

    app.post('/triplet', function (req, res) {
      var packet = req.body;
      var output = jiff.number(packet.computation_id, packet.from_id, packet.msg);
      res.send(JSON.stringify(output));
    });

    app.post('/number', function (req, res) {
      var packet = req.body;
      var output = jiff.number(packet.computation_id, packet.from_id, packet.msg);
      res.send(JSON.stringify(output));
    });

    app.post('/custom', function (req, res) {
      var packet = req.body;
      jiff.number(packet.computation_id, packet.from_id, packet.msg);
      res.send('ok');
    });

    app.post('/public_key', function (req, res) {
      var packet = req.body;
      var output = jiff.public_key(packet.computation_id, packet.from_id, packet.msg);
      res.send(JSON.stringify(output));
    });


    return jiff;
  }
};

var express = require('express');
var app = express();
var http = require('http').Server(app);

// Serve static files.
app.use('/demos/k-means', express.static('demos/k-means/server1/public'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));

console.log('Direct your browser to *:8082/demos/k-means/controls.html.\n');

// (controls) server jiff instance
require('../../../lib/jiff-server').make_jiff(http, {logs:true});
http.listen(8082, function () { console.log('listening on *:8082'); });

// (submission) server jiff instance
var http2 = require('http').Server(require('express')());
require('../../../lib/jiff-server').make_jiff(http2, {logs:true});
http2.listen(8084, function () { console.log('listening on *:8084'); });

// (clustering) server jiff instance
var http3 = require('http').Server(require('express')());
require('../../../lib/jiff-server').make_jiff(http3, {logs:true});
http3.listen(8086, function () { console.log('listening on *:8086'); });

/***** Set up local compute parties *****/

var mpc = require('./public/mpc');
const fs = require('fs');

var jiff_client_submit = mpc.connect('http://localhost:8084', 'undefined', {
    party_count: 20,
    Zp: null,
    party_id: 1,
    listeners: {
        "log": function (sender, message) { console.log(sender, message); },
        "add": function (sender, message) {
            // TODO: add error catching for message
            var point = JSON.parse(message);

            console.log("adding shares to server 1");

            // Read current database
            var shares = [];
            fs.readFile(__dirname + '/server_1_shares.json', (err, data) => {
                if (err) throw err;
                shares = JSON.parse(data);

                // Add the new submitted preferences
                shares.push(point);
                fs.writeFile(__dirname + '/server_1_shares.json', JSON.stringify(shares), function(err) {if (err) throw err;});
            });

            console.log("added ", point);
            // socket.send("added " + point);
            jiff_client_submit.emit("submit", [sender], "added " + point, false);
        }
    },
    onError: function (error) { console.log(error); },
    onConnect: function () { console.log("onConnect"); }
});

var jiff_other_server = null;
var jiff_control_panel = mpc.connect('http://localhost:8082', 'undefined', {
    party_count: 2,
    Zp: null,
    party_id: 1,
    listeners: {
        "log": function (sender, message) { console.log(sender, message); },
        "cluster": function (sender, message) {
            console.log(sender, message);
            if (jiff_other_server == null) {
                jiff_other_server = mpc.connect('http://localhost:8086', 'undefined', {
                    party_count: 2,
                    Zp: 229,
                    party_id: 1,
                    listeners: {
                        "log": function (sender, message) { console.log(sender, message); }
                    },
                    onError: function (error) { console.log(error); },
                    onConnect: function () {
                        console.log("onConnect");

                        jiff_other_server.emit("cluster", [2], "start", false);
                        cluster();
                    }
                });
            }
        }
    },
    onError: function (error) { console.log(error); },
    onConnect: function () { console.log("onConnect"); }
});

// k-Means
var k = 5;

// r rounds
var r = 5;

var means = [];

// Begin Clustering
// eslint-disable-next-line no-unused-vars
function cluster() {
    // Pick "random" half-means to submit
    for (var i = 0; i < k; i++) {
        means[i] = Array.from({length: 10}, () => Math.round(Math.random() * 6));
    }

    // Load test data
    var points = [];
    fs.readFile(__dirname + '/server_1_shares.json', (err, data) => {
        if (err) throw err;
        points = JSON.parse(data);

        // eslint-disable-next-line no-undef
        var promise = mpc.computeClusters(means, points, k, r, jiff_other_server);
        promise.then(handleResult.bind(null, k, r));
    });
}

function handleResult(k, r, result) {
    console.log("result opened", k, r, result);
    console.log("All Done");
    meansSave(result);
    process.exitCode = 1;

    // reset
    console.log("is disconnecting");
    jiff_other_server.disconnect(false, true);
    jiff_other_server = null;
    console.log("has disconnected");
}

function printMeans() {
    var output = "";
    for (var i = 0; i < k; i++) {
        output += "(";
        for (var d = 0; d < 10; d++) {
            output += Math.round(means[i][d]);
        }
        output += ")\n";
    }
    console.log(output+"\n");
}

function meansSave(result) {
    var prefsize = [3, 4, 2, 13, 2, 2, 2, 2, 2, 2];
    var profiles = Array.from({length: Math.floor(result.length/10)}, () => Array.from({length: 11}, () => null));
    for (var i = 0; i < Math.floor(result.length/10)*10; i++) {
        profiles[Math.floor(i/10)][i%10+1] = Math.floor(result[i]/prefsize[i%10]);
    }
    fs.writeFile(__dirname + '/public/profiles.json', JSON.stringify(profiles), function(err) {if (err) throw err;});
}

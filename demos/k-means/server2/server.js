var express = require('express');
var app = express();

// Serve static files.
app.use('/demos/k-means', express.static('demos/k-means/server2/public'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));
console.log('Direct your browser to *:8288/demos/k-means/client.html.\n');

// (submission) server jiff instance
var http = require('http').Server(app);
require('../../../lib/jiff-server').make_jiff(http, {logs:true});
http.listen(8288, function () {
  console.log('listening on *:8288');
});

// (recommendation) server jiff instance
var http2 = require('http').Server(require('express')());
require('../../../lib/jiff-server').make_jiff(http2, {logs:true});
http2.listen(8289, function () { console.log('listening on *:8289'); });

/***** Set up local compute parties *****/

var mpc = require('./public/mpc');
const fs = require('fs');

var jiff_client_submit = mpc.connect('http://localhost:8288', 'undefined', {
    party_count: 20,
    Zp: null,
    party_id: 1,
    listeners: {
        "log": function (sender, message) { console.log(sender, message); },
        "add": function (sender, message) {
            // TODO: add error catching for message
            var point = JSON.parse(message);

            console.log("adding shares to server 2");

            // Read current database
            var shares = [];
            fs.readFile(__dirname + '/server_2_shares.json', (err, data) => {
                if (err) throw err;
                shares = JSON.parse(data);

                // Add the new submitted preferences
                shares.push(point);
                fs.writeFile(__dirname + '/server_2_shares.json', JSON.stringify(shares), function(err) {if (err) throw err;});
            });

            console.log("added ", point);
            // socket.send("added " + point);
            jiff_client_submit.emit("submit", [sender], "added " + point, false);
        }
    },
    onError: function (error) { console.log(error); },
    onConnect: function () { console.log("onConnect"); }
});

var jiff_client_recommend = null;
function jiff_rec_init() {
    return mpc.connect('http://localhost:8289', 'undefined', {
        party_count: 2,
        Zp: 13,
        listeners: {
            "log": function (sender, message) { console.log(sender, message); },
            "compare": function (sender, message) {
                console.log("comparing");
                compare();
            }
        },
        onError: function (error) { console.log(error); },
        onConnect: function () { console.log("onConnect"); }
    });
}
jiff_client_recommend = jiff_rec_init();

var jiff_other_server = mpc.connect('http://localhost:8086', 'undefined', {
    party_count: 2,
    Zp: 229,
    party_id: 2,
    listeners: {
        "log": function (sender, message) { console.log(sender, message); },
        "cluster": function (sender, message) {
            // IF "start":
            console.log(sender, message);
            jiff_other_server.emit("log", [1], "starting k-means", false);
            cluster();
        }
    },
    onError: function (error) { console.log(error); },
    onConnect: function () { console.log("onConnect"); }
});

var means = [];
var k = 5;  // k-Means
var r = 2;  // r rounds

// Begin Clustering
// eslint-disable-next-line no-unused-vars
function cluster() {
    // Pick "random" half-means to submit
    for (var i = 0; i < k; i++) {
        means[i] = Array.from({length: 10}, () => Math.round(Math.random() * 6));
    }

    // Load test data
    var points = [];
    fs.readFile(__dirname + '/server_2_shares.json', (err, data) => {
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

    for (var i = 0; i < k; i++) {
        for (var d = 0; d < 10; d++) {
            means[i][d] = result[(i*10)+d];
        }
    }
    printMeans();

    reset();
}

function printMeans(means_local = means, start = 0, k_local = k) {
    var output = "";
    for (var i = 0; i < k_local; i++) {
        output += "(";
        for (var d = start; d < start + 9; d++) {
            output += Math.round(means_local[i][d]) + ", ";
        }
        output += Math.round(means_local[i][d]) + ")\n";
    }
    console.log(output);
}

// Do preference comparison
// eslint-disable-next-line no-unused-vars
function compare() {
    // Load preferences profiles
    var user_data = [];
    fs.readFile(__dirname + '/public/profiles.json', (err, data) => {
        if (err) throw err;
        user_data = JSON.parse(data);
        console.log("prefs = user_data[#] = (Ex.): " + user_data[0]);
        console.log("user_data" + user_data);

        /*** Begin MPC Comparison ***/
        var profilesCount = 2;//user_data.length;
        var prefCount = 10;//user_data[0].length;
        for (var j = 1; j <= profilesCount; j++) {
            var prefs = user_data[j-1];
            for (var i = 1; i < prefCount; i++) {
                // eslint-disable-next-line no-undef
                var promise = mpc.computeComparison(prefs[i], null, jiff_client_recommend);
                promise.then(function (res){console.log(res);});
            }
            mpc.computeComparison(prefs[prefCount], null, jiff_client_recommend).then(function (){
                console.log("recommendation completed");
                jiff_client_recommend.disconnect(false, true);
                jiff_client_recommend = jiff_rec_init();
            });
        }
    });
}

function reset() {
    console.log("is disconnecting");
    jiff_other_server.disconnect(false, true);
    // jiff_other_server.disconnect(true, true, function () {
    console.log("has disconnected");
        jiff_other_server = mpc.connect('http://localhost:8086', 'undefined', {
            party_count: 2,
            Zp: 229,
            party_id: 2,
            listeners: {
                "log": function (sender, message) { console.log(sender, message); },
                "cluster": function (sender, message) {
                    // IF "start":
                    console.log(sender, message);
                    jiff_other_server.emit("log", [1], "starting k-means", false);
                    cluster();
                }
            },
            onError: function (error) { console.log(error); },
            onConnect: function () { console.log("onReconnect"); }
        });
    // });
}

function meansSave(result) {
    var prefsize = [3, 4, 2, 13, 2, 2, 2, 2, 2, 2];
    var profiles = Array.from({length: Math.floor(result.length/10)}, () => Array.from({length: 11}, () => null));
    for (var i = 0; i < Math.floor(result.length/10)*10; i++) {
        profiles[Math.floor(i/10)][i%10+1] = Math.floor(result[i]/prefsize[i%10]);
    }
    fs.writeFile(__dirname + '/public/profiles.json', JSON.stringify(profiles), function(err) {if (err) throw err;});
}

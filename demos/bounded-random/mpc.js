(function (exports, node) {
    var saved_instance;

    /*
     * Connect to the server and initialize the jiff instance
     */
    exports.connect = function (hostname, computation_id, options) {
        var opt = Object.assign({}, options);

        if (node) {
            // eslint-disable-next-line no-undef
            jiff = require('../../lib/jiff-client');
        }

        // eslint-disable-next-line no-undef
        saved_instance = jiff.make_jiff(hostname, computation_id, opt);
        return saved_instance;
    };

    /*
     * The MPC computation
     */
    exports.compute = function (input, jiff_instance) {
        if (jiff_instance == null) {
            jiff_instance = saved_instance;
        }

        // The MPC implementation should go *HERE*
        var lower = jiff_instance.share(input[0]);
        var upper = jiff_instance.share(input[1]);

        var min = lower[1];
        for (var i = 2; i <= jiff_instance.party_count; i++) {
            min = lower[i].sgt(min).if_else(lower[i], min);
        }

        var max = upper[1];
        for (var i = 2; i <= jiff_instance.party_count; i++) {
            max = upper[i].slt(max).if_else(upper[i], max);
        }

        var range = max.ssub(min);

        // //DEBUG
        // console.log("lower "+input[0]);
        // console.log("upper "+input[1]);
        // for (var i = 2; i <= jiff_instance.party_count; i++) {
        //     lower[i].logLEAK("lower");//console.log("lower "+lower);
        //     upper[i].logLEAK("upper");//console.log("upper "+upper);
        // }
        // min.logLEAK("min");
        // max.logLEAK("max");
        // range.logLEAK("range");

        // Array of random number in every range 0 to i
        // candidates = [secretZero, ...]
        var candidates = [(function(){zero=jiff_instance.share(0);return zero[1].sadd(zero[2]);})()];
        for (var i = 1; i <= maximum; i++) {
            var random = jiff_instance.share(Math.round(Math.random() * i / jiff_instance.party_count));
            candidates[i] = random[1];
            for (var j = 2; j <= jiff_instance.party_count; j++) {
                candidates[i] = candidates[i].sadd(random[j]);
            }
            // candidates[i].logLEAK("candidate "+i)
        }

        // Search for the random number in the correct range
        var point = candidates[0];
        for (var i = 0; i <= maximum; i++) {
            point = range.ceq(i).if_else(candidates[i], point);
        }

        // Shift range to the correct place
        point = point.sadd(min);

        // Return a promise to the final output(s)
        return [jiff_instance.open(point), jiff_instance.open(min.slt(max))];
    };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

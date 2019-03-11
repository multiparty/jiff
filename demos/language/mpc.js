(function (exports, node) {
    var saved_instance;

    /**
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

    function snor_bit(caller, share) {
        return caller.sor_bit(share).cxor_bit(1);
    }

    function sand_bit(caller, share) {
        return snor_bit(snor_bit(caller, caller), snor_bit(share, share));
    }

    function snand_bit(caller, share) {
        return sand_bit(caller, share).cxor_bit(1);
    }

    // Supported operations
    const ops = {"^": 0, "&": 1, "|": 2, ">": 3}

    /**
      * The MPC computation
      */
    exports.compute = function (input, jiff_instance) {
        if (jiff_instance == null) {
            jiff_instance = saved_instance;
        }

        /**** The MPC implementation goes -HERE- ****/
        var x = [];  // make secret shares of all the variables
        for (var i = 0; i < input[0].length; i++) {
            console.log("x["+i+"] = "+input[0][i]);
            let share = jiff_instance.share(input[0][i]);
            x[i] = share[1].sxor_bit(share[2]);
        }

        // do each operation with MPC
        var result = x[0];
        for (var i = 1; i <= input[1].length; i++) {
            let op = input[1][i-1];
            if (op == ops["^"]) {
                result = result.sxor_bit(x[i]);
            } else if (op == ops["&"]) {
                result = sand_bit(result, x[i]);
            } else if (op == ops["|"]) {
                result = result.sor_bit(x[i]);
            } else if (op == ops[">"]) {
                result = snor_bit(result, x[i]);
            } else {
                console.log("operation not supported ("+op+")");
                //jiff_instance.disconnect(false, true);
                break;
            }
        }

        // Return a promise to the final output
        return jiff_instance.open(result);
    };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

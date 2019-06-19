(function (exports, node) {
    var saved_instance;
    var Zp;

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
        Zp = saved_instance.Zp;
        return saved_instance;
    };

    /**
     *  Long Division
     *  Compute q in a=q*b+r where p > a ≥ b > 0
     *  Cost:
     */
    function longD(a, b) {
        let n = a.length;
        let zero = () => saved_instance.protocols.generate_and_share_zero();
        var q = (new Array(n)).fill(zero()).map(zero);  // quotient
        var r = (new Array(n)).fill(zero()).map(zero);  // remainder

        // loop over each bit
        for (var i = n-1; i >= 0; i--) {
            // double r and add bit i of a
            r.pop();
            r = [a[i], ...r];

            // Get the next bit of the quotient
            // and conditionally subtract b from the
            // intermediate remainder to continue
            let sub_result = ssub_bits_safe(r, b);  // safe because we keep the last borrow that signifies an overflow
            let cmp = sub_result.overflowed.not();  // sgteq_bits(r, b)
            let r_minus_b = sub_result.diff;

            q[i] = cmp;

            for (var j = 0; j < r.length; j++) {
                r[j] = cmp.if_else(r_minus_b[j], r[j]);
            }
        }
    function cdiv_bits(a, b) {
        let n = a.length;
        let zero = () => saved_instance.protocols.generate_and_share_zero();
        var q = (new Array(n)).fill(zero()).map(zero);  // quotient
        var r = (new Array(n)).fill(zero()).map(zero);  // remainder

        // loop over each bit
        for (var i = n-1; i >= 0; i--) {
            // double r and add bit i of a
            r.pop();
            r = [a[i], ...r];

            // Get the next bit of the quotient
            // and conditionally subtract b from the
            // intermediate remainder to continue
            let sub_result = csub_cbits_safe(r, b);  // safe because we keep the last borrow that signifies an overflow
            let cmp = sub_result.overflowed.not();  // sgteq_cbits(r, b)
            let r_minus_b = sub_result.diff;

            q[i] = cmp;

            for (var j = 0; j < r.length; j++) {
                r[j] = cmp.if_else(r_minus_b[j], r[j]);
            }
        }

        return {quo: q, rem: r};
    }

    /**
     *  Compute the product of secret bits
     *  Note: Overflow is irrelevant
     *        The full result is calculated and bit_composition
     *        if/when done later will wrap it around automatically
     *  Cost: (2 * bits + 4) * bits smult
     */
    function smult_bits(a, b, n = a.length) {
        let z = saved_instance.protocols.generate_and_share_zero();
        let zero = () => saved_instance.protocols.generate_and_share_zero();

        // Initialize the product c with lg(a)+lg(b) bits
        var c = (new Array(2*n)).fill(zero()).map(zero);

        // Shift b to create the intermediate values,
        // and sum if the corresponding bit in a is 1
        var intermediate = (new Array(n)).fill([]);
        for (var i = 0; i < n; i++) {
            for (var j = 0; j < n; j++) {
                intermediate[i][j] = a[i].if_else(b[j], z);
            }
        }

        for (var i = 0; i < n; i++) {
            c = sadd_bits(c, [...(new Array(i)).fill(zero()), ...intermediate[i], ...(new Array(n-i)).fill(zero())]);
        }

        return c;
    }

    /**
     *  Compute the product of secret bits with constant bits
     *  Cost: 4 * bits^2 smult
     */
    function cmult_bits(a, b, n = a.length) {
        let zero = () => saved_instance.protocols.generate_and_share_zero();

        // Initialize the product c with lg(a)+lg(b) bits
        var c = (new Array(2*n)).fill(zero()).map(zero);

        // Shift b to create the intermediate values,
        // and sum if the corresponding bit in a is 1
        for (var i = 0; i < n; i++) {
            if (b[i]) {
                c = sadd_bits(c, [...(new Array(i)).fill(zero()), ...a, ...(new Array(n-i)).fill(zero())]);
            }
        }

        return c;
    }

    function local_compose(bits) {
        var number = 0;
        for (var i = bits.length-1; i >= 0; i--) {
            number <<=1;
            number += bits[i];
        }
        return number;
    }

    function open_bits_to_array(bits) {
        var opened = [];
        for (var i = 0; i < bits.length; i++) {
            opened[i] = saved_instance.open(bits[i]);
        }
        return opened;
    }

    function open_bits(bits) {
        var deferred_number = $.Deferred();
        Promise.all(open_bits_to_array(bits)).then(function (bits) {
            deferred_number.resolve(local_compose(bits));
        });
        return deferred_number.promise();
    }

    /**
     * The MPC computation
     */
    exports.compute = function (input, part, protocal, jiff_instance) {
        if (jiff_instance == null) {
            jiff_instance = saved_instance;
        } else {
            saved_instance = jiff_instance;
        }

        // The MPC implementation should go *HERE*
        var shares = jiff_instance.share(input);
        var cmp = shares[1].sgt(shares[2]);
        var numerator = cmp.if_else(shares[1], shares[2]);
        var denominator = cmp.if_else(shares[2], shares[1]);

        var deferred_results = {quo: $.Deferred(), rem: $.Deferred()};
        console.log("protocal: " + protocal);
        if (protocal === "experimental 1") {
            console.log("run experimental");

            bit_decomposition(numerator).then(function(numerator_bits){
                bit_decomposition(denominator).then(function(denominator_bits){
                    let out = longD(numerator_bits, denominator_bits);
                    var quo = jiff_instance.protocols.bit_composition(out.quo);
                    var rem = jiff_instance.protocols.bit_composition(out.rem);

                    // Return a promise to the final output(s)
                    deferred_results.quo.resolve(quo);
                    deferred_results.rem.resolve(rem);
                });
            });
        } else {  // Default
            console.log("run default");

            var quo = numerator.sdiv(denominator);
            var rem = jiff_instance.protocols.generate_and_share_zero();  // old sdiv doesn't keep track of the remainder

            // Return a promise to the final output(s)
            deferred_results.quo.resolve(quo);
            deferred_results.rem.resolve(rem);
        }

        return {quo: deferred_results.quo.promise(), rem: deferred_results.rem.promise(), jiff_instance: jiff_instance};
    };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

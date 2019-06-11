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

    /*
     *  NOTE: NOT COMPLETE or FIXED or CLEANED
     */
    function bit_decomposition(s) {
        var n = 4;//Math.ceil(Math.log2(Zp));//plus one?
        let zero = saved_instance.protocols.generate_and_share_zero;
        var bits = [zero(), zero(), zero(), zero()];//[zero(), ...jiff_instance.server_generate_and_share({bit: true, count: n-1})];

        var r = saved_instance.protocols.bit_composition(bits);

        var deferred = $.Deferred();
        saved_instance.open(r.sadd(s)).then(function(r_plus_s) {
            console.log("r_plus_s", r_plus_s);
            var x = [...("0".repeat(Math.ceil(Math.log2(Zp))) + r_plus_s.toString(2)).slice(-n)].reverse().map(e => +e);

            var diff = csub_bits([...x], bits);

            // Return the array
            deferred.resolve(diff);
        });

        return deferred.promise();
    }

    /**
     *  Compute q in a=q*b+r where p > a ≥ b > 0
     *  Cost:
     */
    function longD(a, b) {
        // saved_instance.protocols.bit_composition(a).logLEAK('a');
        // saved_instance.protocols.bit_composition(b).logLEAK('b');
        let n = a.length;
        console.log("a.length", a.length);
        console.log("b.length", b.length);

        let zero = () => saved_instance.protocols.generate_and_share_zero();
        var q = (new Array(n)).fill(zero()).map(zero);  // quotient
        var r = (new Array(n)).fill(zero()).map(zero);  // remainder

        // loop over each bit
        for (var i = n-1; i >= 0; i--) {
            // double r and add bit i of a
            r.pop();
            r = [a[i], ...r];
            // saved_instance.protocols.bit_composition(r).logLEAK('r_' + i);
            // saved_instance.protocols.bit_composition(b).logLEAK('b_' + i);

            // Get the next bit of the quotient
            // and conditionally subtract b from the
            // intermediate remainder to continue
            let cmp = slt_bits(r, b).not();  // sgteq_bits
            //cmp.logLEAK("comparison" + i);

            q[i] = cmp;

            let sub = ssub_bits(r, b);
            for (var j = 0; j < r.length; j++) {
                r[j] = cmp.if_else(sub[j], r[j]);
            }

            //saved_instance.protocols.bit_composition(r).logLEAK('r after' + i);
        }

        return {quo: q, rem: r};
    }

    /**
     *  Compute the less-than comparison using borrows
     *  Cost: bits * 3 smult
     */
    function slt_bits(x, y, n = x.length) {
        // initialize first borrowed bit
        // and loop over the remaining bits
        var borrow = x[0].not().smult(y[0]);
        for (var i = 1; i < n; i++) {
            borrow = x[i].sxor_bit(y[i]).not().smult(borrow).sadd(x[i].not().smult(y[i]));
        }
        return borrow;  // borrow is 1 if x-y is negative
    }

    /**
     *  Compute difference of secret bits
     *  Cost: bits * 4 smult
     */
    function ssub_bits(x, y, n = x.length) {
        // initialize difference with correct lsb
        var diff = [x[0].sxor_bit(y[0]), new Array(n-1)];

        // initialize first borrowed bit
        var borrow = x[0].not().smult(y[0]);

        // loop over the remaining bits
        for (var i = 1; i < n; i++) {
            // single digit subtraction
            diff[i] = x[i].sxor_bit(y[i]);

            // save and update borrow
            let last_borrow = borrow;
            borrow = diff[i].not().smult(borrow).sadd(x[i].not().smult(y[i]));

            // disclude last borrow
            diff[i] = diff[i].sxor_bit(last_borrow);
        }

        return diff;
    }

    /**
     *  Compute difference of constant bits and secret bits
     *  difference[] := constant[] - secret[]
     *  Note: Final borrow is 1 if invalid/negative
     *  Cost: bits * 2 smult
     */
    function csub_bits(x, y, n = x.length) {
        // initialize difference with correct lsb
        var diff = [y[0].cxor_bit(x[0]), new Array(n-1)];

        // initialize first borrowed bit
        var borrow = y[0].cmult(1-x[0]);

        // loop over the remaining bits
        for (var i = 1; i < n; i++) {
            // single digit subtraction
            diff[i] = y[i].cxor_bit(x[i]);

            // save and update borrow
            let last_borrow = borrow;
            borrow = diff[i].not().smult(borrow).sadd(y[i].cmult(1-x[i]));

            // disclude last borrow
            diff[i] = diff[i].sxor_bit(last_borrow);
        }

        return diff;
    }

    /**
     *  Compute sum of secret bits
     *  Note: Final carry is 1 if overflowed, 0 otherwise
     *  Cost: bits * 4 smult
     */
    function sadd_bits(x, y, n = x.length) {
        // initialize difference with correct lsb
        var sum = [x[0].sxor_bit(y[0]), new Array(n-1)];

        // initialize first carried bit
        var carry = x[0].smult(y[0]);

        // loop over the remaining bits
        for (var i = 1; i < n; i++) {
            // single digit addition
            sum[i] = x[i].sxor_bit(y[i]);

            // save and update carry
            let last_carry = carry;
            carry = x[i].smult(y[i]).sor_bit(x[i].sxor_bit(y[i]).smult(carry));

            // add the last carry
            sum[i] = sum[i].sxor_bit(last_carry);
        }

        return sum;
    }

    /**
     * The MPC computation
     */
    exports.compute = function (input, part, protocal, jiff_instance) {
        if (jiff_instance == null) {
            jiff_instance = saved_instance;
        }

        // The MPC implementation should go *HERE*
        var shares = jiff_instance.share(input);
        var cmp = shares[1].sgt(shares[2]);
        var numerator = cmp.if_else(shares[1], shares[2]);
        var denominator = cmp.if_else(shares[2], shares[1]);
        numerator.logLEAK("numerator");
        denominator.logLEAK("denominator");
        var quo;
        var rem;
        var deferred_results = {quo: $.Deferred(), rem: $.Deferred()};
        console.log("protocal: " + protocal);
        if (protocal === "experimental 1") {
            console.log("run experimental");
            bit_decomposition(numerator).then(function(numerator_bits){
                bit_decomposition(denominator).then(function(denominator_bits){
                    // for (var i = 0; i < numerator_bits.length; i++) {
                    //     numerator_bits[i].logLEAK("numerator_bits[" + i + "]");
                    // }
                    // for (var i = 0; i < denominator_bits.length; i++) {
                    //     denominator_bits[i].logLEAK("denominator_bits[" + i + "]");
                    // }
                    // jiff_instance.protocols.bit_composition(numerator_bits).logLEAK('numerator_bits_value');
                    // jiff_instance.protocols.bit_composition(denominator_bits).logLEAK('denominator_bits_value');
                    // jiff_instance.protocols.bit_composition(numerator_bits.reverse()).logLEAK('numerator_reverse_value');
                    // jiff_instance.protocols.bit_composition(denominator_bits.reverse()).logLEAK('denominator_reverse_value');
                    let out = longD(numerator_bits, denominator_bits);
                    quo = jiff_instance.protocols.bit_composition(out.quo);
                    rem = jiff_instance.protocols.bit_composition(out.rem);

                    //let out = {quo: jiff_instance.protocols.bit_composition(numerator_bits), rem: jiff_instance.protocols.bit_composition(denominator_bits)};

                    // Return a promise to the final output(s)
                    // return {quo: jiff_instance.open(quo), rem: jiff_instance.open(rem)};
                    deferred_results.quo.resolve(quo);
                    deferred_results.rem.resolve(rem);
                });
            });
        } else {  // Default
            console.log("run default");
            quo = numerator.sdiv(denominator);
            rem = jiff_instance.protocols.generate_and_share_zero();

            // Return a promise to the final output(s)
            // return {quo: jiff_instance.open(quo), rem: jiff_instance.open(rem)};
            deferred_results.quo.resolve(quo);
            deferred_results.rem.resolve(rem);
        }

        return {quo: deferred_results.quo.promise(), rem: deferred_results.rem.promise(), jiff_instance: saved_instance/*jiff_instance*/};
    };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

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

    function local_decompose(number, bitLength) {
        return [...("0".repeat(bitLength) + number.toString(2)).slice(-bitLength)].reverse().map(bit => +bit);
    }

    /*
     *  Secret Rejection Sampling
     *  Uniformly sample numbers in the range [0, n)
     */
    function rejection_sample(upper_bound = Zp, bitLength = Math.ceil(Math.log2(Zp)), deferred_sampling = $.Deferred()) {
        var bits = saved_instance.server_generate_and_share({bit: true, count: bitLength});
        var cmp_lt_ub = saved_instance.protocols.clt_bits(upper_bound+1, bits).not();
        saved_instance.open(cmp_lt_ub).then(function(cmp_lt_ub) {
            if (cmp_lt_ub === 1) {
                deferred_sampling.resolve(bits);
            } else {
                console.log("resample");
                rejection_sample(upper_bound, bitLength, deferred_sampling);
            }
        });
        return deferred_sampling;
    }

    /*
     *  Secret bit decomposition protocal
     *  Decompose a secret share into an array of secret shared bits
     *  Cost: 1 open, 2 ssub_bits, log p if_else, 1 bit_composition
     */
    function bit_decomposition(s) {
        var bitLength = Math.ceil(Math.log2(Zp));  // ceil not floor. Note that we subtract 1 later

        var deferred = $.Deferred();

        // generate the bits of a random number less than our prime
        rejection_sample(Zp, bitLength).promise().then(function (bits) {
            let r = saved_instance.protocols.bit_composition(bits);
            saved_instance.open(r.sadd(s)).then(function(r_plus_s) {

                // Locally decompose the sum into bits
                var x = local_decompose(r_plus_s, bitLength);
                // Compute the bits of s (when r+s<p)
                let sub_result = csub_bits_safe([...x], bits);  // safe because we keep the last borrow that signifies an overflow
                var diff = sub_result.diff;

                // Locally decompose the sum into bits plus our prime
                var x_plus_p = local_decompose(r_plus_s + Zp, bitLength + 1);
                // Compute the bits of s (when r+s≥p)
                var diff_corrected = csub_bits([...x_plus_p], [...bits, saved_instance.protocols.generate_and_share_zero()]);  // msb will be zero

                // Check overflow
                var overflowed = sub_result.overflowed;
                // diff.map(bit => bit.cadd(overflowed.cmult(  Zp???  )))
                for (var i = 0; i < bitLength; i++) {
                    diff[i] = overflowed.if_else(diff_corrected[i], diff[i]);
                }

                // Return the array
                deferred.resolve(diff);
            });
        });

        return deferred.promise();
    }

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
     *  Compute difference of two arrays of secret bits
     *  Note: Final borrow is 1 if invalid/negative
     *  Cost: bits * 4 smult
     */
    function ssub_bits(x, y, n = x.length) {
        return ssub_bits_safe(x, y, n).diff;
    }

    /**
     * Compute difference of two arrays of secret bits
     *  Returns the difference AND whether or not it overflowed
     *  Cost: bits * 4 smult
     */
    function ssub_bits_safe(x, y, n = x.length) {
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

        return {diff: diff, overflowed: borrow};
    }

    /**
     *  Compute difference of constant bits and secret bits
     *  difference[] := constant[] - secret[]
     *  Note: Final borrow is 1 if invalid/negative
     *  Cost: bits * 2 smult
     */
    function csub_bits(x, y, n = x.length) {
        return csub_bits_safe(x, y, n).diff;
    }

    /**
     *  Compute difference of constant bits and secret bits
     *  difference[] := constant[] - secret[]
     *  Returns the difference AND whether or not it overflowed
     *  Cost: bits * 2 smult
     */
    function csub_bits_safe(x, y, n = x.length) {
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

        return {diff: diff, overflowed: borrow};
    }

    /**
     *  Compute sum of secret bits
     *  Note: Final carry is 1 if overflowed, 0 otherwise
     *        and the sum n+1 bits not n
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

        return sum.concat(carry);
    }

    /**
     *  Compute sum of secret bits with constant bits
     *  Note: The sum n+1 bits not n
     *  Cost: bits * 4 smult
     */
    function cadd_bits(x, y, n = x.length) {
        // initialize difference with correct lsb
        var sum = [x[0].cxor_bit(y[0]), new Array(n-1)];

        // initialize first carried bit
        var carry = x[0].cmult(y[0]);

        // loop over the remaining bits
        for (var i = 1; i < n; i++) {
            // single digit addition
            sum[i] = x[i].cxor_bit(y[i]);

            // save and update carry
            let last_carry = carry;
            carry = x[i].cmult(y[i]).sor_bit(x[i].cxor_bit(y[i]).smult(carry));

            // add the last carry
            sum[i] = sum[i].sxor_bit(last_carry);
        }

        return sum.concat(carry);
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

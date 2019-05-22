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
     * Vector dot product with one secret and one constant vector
     */
    function svector_cdot(s, c) {
        if (typeof c === "string") {
            var c = JSON.parse("["+c+"]");
        }
        if (s.length == c.length) {
            var sum = s[0].cmult(c[0]);
            for (var i = 1; i < s.length; i++) {
                sum = sum.sadd(s[i].cmult(c[i]));
            }
        } else {
            throw "Dot Product Error: dimension mismatch";
        }
        return sum;
    }

    /*
     *  Secret vector scalar product operation on a constant vector
     */
    function cvector_smult(c, s) {
        var v = [];
        for (var i = 0; i < c.length; i++) {
            v[i] = s.cmult(c[i]);
        }
        return v;
    }

    /*
     *  Secret vector addition
     */
    function svector_sadd(s1, s2) {
        var sum = [];
        if (typeof s1 === "string") {
            var s1 = JSON.parse("["+s1+"]");
        }
        if (typeof s2 === "string") {
            var s2 = JSON.parse("["+s2+"]");
        }
        if (s1.length == s2.length) {
            for (var i = 0; i < s1.length; i++) {
                sum[i] = s1[i].sadd(s2[i]);
            }
        } else {
            throw "Vector Addition Error: dimension mismatch";
        }

        return sum;
    }

    /*
     *  Unit vector map from one-dimentional domain and codomain
     */
    function vector_map(d, cd) {
        var e = [...d, ...cd];
        var a = {};
        const blank = Array(d.length*2).fill(0);
        for (var i = 0; i < blank.length; i++) {
            vector = [...blank];
            vector[i] = 1;
            a[e[i]] = vector;
        }
        var map = [];
        for (var c in d) {
            map[a[d[c]]] = a[cd[c]];
        }
        return map;
    }

    /*
     * The MPC computation
     */
    exports.compute = function (number_map, input, op = "add", jiff_instance) {
        if (jiff_instance == null) {
            jiff_instance = saved_instance;
        }

        var final_deferred = $.Deferred();
        var final_promise = final_deferred.promise();

        // Convert map to a map of vectors
        console.log(number_map);
        var d = number_map[0];   // domain
        var cd = number_map[1];  // codomain
        var map = vector_map(d, cd);
        var n = d.length;  // map size

        /*** The MPC implementation goes -HERE- ***/

        // Sort inputs
        input = jiff_instance.share(input);
        let cmp = input[1].sgt(input[2]);
        min = cmp.if_else(input[2], input[1]);
        max = cmp.if_else(input[1], input[2]);

        // Convert inputs to vectors
        var x = [];
        var y = [];
        for (var i = 0; i < n; i++) {
            x[i] = min.ceq(d[i]).if_else(1, 0);
            y[i] = max.ceq(d[i]).if_else(1, 0);
        }
        for (var i = n; i < n*2; i++) {
            x[i] = jiff_instance.share(0)[1].cadd(0);
            y[i] = jiff_instance.share(0)[1].cadd(0);
        }

        // Evaluate function
        var key = Object.keys(map)[0];
        var output_x = cvector_smult(map[key], svector_cdot(x, key));
        var output_y = cvector_smult(map[key], svector_cdot(y, key));
        for (var i = 1; i < n; i++) {
            key = Object.keys(map)[i];
            output_x = svector_sadd(output_x, cvector_smult(map[key], svector_cdot(x, key)));
            output_y = svector_sadd(output_y, cvector_smult(map[key], svector_cdot(y, key)));
        }

        // Decode output vectors back to scalar values
        var x_mapped = jiff_instance.share(cd[0])[1].cadd(0);
        var y_mapped = jiff_instance.share(cd[0])[1].cadd(0);
        for (var i = 0; i < n; i++) {
            x_mapped = output_x[i+n].if_else(cd[i], x_mapped);
            y_mapped = output_y[i+n].if_else(cd[i], y_mapped);
        }

        // Open the results
        Promise.all([jiff_instance.open(x_mapped), jiff_instance.open(y_mapped)]).then(function (results) {
            final_deferred.resolve(results);
        });

        // Return a promise to the final output(s)
        return final_promise;
    };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

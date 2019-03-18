(function (exports, node) {
    var saved_instance;

    /**
    * Connect to the server and initialize the jiff instance
    */
    exports.connect = function (hostname, computation_id, options) {
        var opt = Object.assign({}, options);
        // Added options goes here

        if (node) {
            // eslint-disable-next-line no-undef
            jiff = require('../../../../lib/jiff-client');
        }

        // eslint-disable-next-line no-undef
        saved_instance = jiff.make_jiff(hostname, computation_id, opt);
        // if you need any extensions, put them here

        return saved_instance;
    };


    exports.computeComparison = function (input, flag, jiff_instance) {
        if (jiff_instance == null) {
            jiff_instance = saved_instance;
        }

        // The MPC implementation should go *HERE*
        var shares = jiff_instance.share(input); // Both parties will execute this instruction to secret share their preference hashes
        var equal = shares[1].seq(shares[2]); // Check if shares are equal

        // Return a promise to the final output(s)
        return jiff_instance.open(equal);
    };

    exports.computeClusters = function (init_means, points_, k, r = 1, jiff_instance) {
        if (jiff_instance == null) {
            jiff_instance = saved_instance;
        }

        var allPromises = [];
        var final_deferred = $.Deferred();
        var final_promise = final_deferred.promise();

        /**** The MPC implementation is -HERE- ****/

        // Sum client-picked random means to get the starting means
        var l = points_.length;
        var dim = points_[0].length;
        /* DEBUG OVERRIDES: */
        /**/ r = 2;   // number of rounds iterations
        /**/ k = 2;   // "k" means
        /**/ l = 10;  // number of data points
        /**/ dim = 10;  // dimentions per points
        /* **************** */
        var means = Array.from({length: k}, a => []);
        for (var i = 0; i < k; i++) {
            for (var d = 0; d < dim; d++) {
                // console.log(i, d, init_means[i][d]);
                var mean_shares = jiff_instance.share(init_means[i][d]);
                means[i][d] = mean_shares[1].sadd(mean_shares[2]);
            }
        }

        // Recreate submitted secret shares from JSON file
        var points = Array.from({length: l}, a => []);
        for (var j = 0; j < l; j++) {
            for (var d = 0; d < dim; d++) {
                // console.log(i, d, points_[i][d]);
                var point_share = jiff_instance.secret_share(
                    jiff_instance, true, null, points_[j][d],
                    means[0][0].holders, means[0][0].threshold, means[0][0].Zp
                );
                points[j][d] = point_share;
            }
            points[j][dim] = null;  // cluster id
        }


        /**** Begin Clustering ****/

        for (var round = 1; round <= r; round++) {
            console.log("Starting round "+round+" clustering.  "+(r-round)+" more left.");

            // Assign clusters
            for (var j = 0; j < l; j++) {
                console.log("Proccessing point "+j);

                // compare each point to each mean
                let distance = [];
                for (var i = 0; i < k; i++) {
                    // compare each dimension d
                    let half = means[i][0].ssub(points[j][0]);
                    distance[i] = half.smult(half);
                    for (var d = 1; d < dim; d++) {
                        half = means[i][d].ssub(points[j][d]);
                        let full = half.smult(half);
                        distance[i] = distance[i].sadd(full);
                    }
                }

                // find min distance:  min(distance)
                let min = distance[0];
                let cluster_id = jiff_instance.share(0)[1];  // zero
                for (var i = 1; i < k; i++) {
                    let cmp = min.slt(distance[i]);
                    min = cmp.if_else(min, distance[i]);

                    let i_share = jiff_instance.share(i)[1];
                    cluster_id = cmp.if_else(i_share, cluster_id);
                }
                points[j][dim] = cluster_id;
            }

            // Recalculate means
            var weight = Array.from({length: k}, a => jiff_instance.share(0)[1]);
            mean = Array.from({length: k}, a => Array.from({length: l}, a => jiff_instance.share(0)[1]));
            for (var j = 0; j < l; j++) {
                for (var i = 0; i < k; i++) {
                    let i_share = jiff_instance.share(i)[1];
                    let cmp = points[j][dim].seq(i_share);
                    for (var d = 0; d < dim; d++) {
                        mean[i][d] = cmp.if_else(mean[i][d].sadd(points[j][d]),  mean[i][d]);
                    }
                    weight[i] = cmp.if_else(weight[i].cadd(1), weight[i]);
                }
            }
            for (var i = 0; i < k; i++) {
                for (var d = 0; d < dim; d++) {
                    mean[i][d] = mean[i][d].sdiv(weight[i]);
                }
            }
        }


        // Open all the final means
        for (var i = 0; i < k; i++) {
            for (var d = 0; d < dim; d++) {
                allPromises.push(jiff_instance.open(means[i][d]));
            }
        }

        // Return the results
        Promise.all(allPromises).then(function (results) {
            final_deferred.resolve(results);
        });
        return final_promise;
    };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

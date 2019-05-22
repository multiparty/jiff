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
     *  New secret share from MPC operation from both parties
     */
    function eval(a, op = "add") {
        if (a[1] == null || a[1].Zp == null || a[2] == null || a[2].Zp == null) {
            // if not a share, create one
            var a = jiff_instance.share(a);
        }
        if (op.substr(0, 1) !== "s") {
            // Add an extra 's' (if necessary)
            op = "s"+op;
        }
        return a[1][op](a[2]);
    }

    /*
     *  New secret share from constant
     */
    function secret(a) {
        return (a==0)?eval(0):eval(0).cadd(a);
    }

    class sarray {
        /*
         *  Set up an array of secret shares
         */
        constructor(array = [], op, callback = function(){}) {
            if (op == null) {  // already secret-shared
                this.sa = array;
            } else {  // create and secret-share the array
                this.sa = [];
                for (var i = 0; i < array.length; i++) {
                    let element = jiff_instance.share(array[i]);
                    this.sa[i] = eval(element, op);
                }
            }

            callback(this);
        }

        /**
         *  Secret array operations
         */

        /*
         *  Get share at a secret index
         */
        get(index, callback = function(){}) {
            if (index.Zp == null) {  // public access
                var element = this.sa[i];
            } else {  // secret access
                var element = this.sa[0];
                for (var i = 0; i < this.sa.length; i++) {
                    element = index.ceq(i).if_else(this.sa[i], element);
                }
            }

            callback(this, element);
            return element;
        }

        /*
         *  Set share at a secret index
         */
        set(share, index, callback = function(){}) {
            if (share.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else if (index.Zp == null) {  // not secret
                console.log("Warning add(): Index not secret");
                this.sa[index] = share;  // set directly
            } else {  // add the share
                for (var i = 0; i < this.sa.length; i++) {
                    this.sa[i] = index.ceq(i).if_else(share, this.sa[i]);
                }

                callback(this);
                return true;
            }
            return false;
        }

        /*
         *  Insert a share at a secret index
         */
        insert(share, index, callback = function(){}) {
            if (share.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else if (index.Zp == null) {  // not secret
                console.log("Warning add(): Index not secret");
                this.sa.splice(index, 0, share);  // insert directly
            } else {  // insert the share
                var padding = secret(Zp-1);  // dummy share used for if_else
                var copy = new sarray([padding, ...this.sa, padding]);
                const new_length = this.sa.length + 1;
                for (var i = 0; i < new_length; i++) {
                    var eq = index.ceq(i);  // at the index
                    var lt = index.clt(i);  // past the index
                    this.sa[i] = eq.if_else(
                                     share,
                                     lt.if_else(
                                         copy.sa[i],
                                         copy.sa[i+1]
                                     )
                    );
                }

                callback(this);
                return true;
            }
            return false;
        }

        /*
         *  Remove a share from a secret index
         */
        remove(index, callback = function(){}) {
            if (index.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else if (index.Zp == null) {  // not secret
                console.log("Warning add(): Index not secret");
                this.sa.splice(index, 1);  // remove directly
            } else {  // remove the share
                var copy = new sarray([...this.sa]);
                const new_length = this.sa.length - 1;
                for (var i = 0; i < new_length; i++) {
                    var lteq = index.clt(i);  // at or past the index
                    this.sa[i] = lteq.if_else(
                                     copy.sa[i+1],
                                     copy.sa[i]
                    );
                }

                callback(this);
                return true;
            }
            return false;
        }

        /*
         *  Checks if a share exists in the array
         */
        contains(share, callback) {
            return indexOf(share, callback).cneq(Zp-1);
        }

        /*
         *  Finds the index of a share in the array
         */
        indexOf(share, callback = function(){}) {
            var index = secret(Zp-1);
            if (share.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else {  // search the array
                var found = secret(0);
                for (var i = 0; i < this.sa.length; i++) {
                    var cmp = this.sa[i].seq(share);  // correct index condition
                    found = found.if_else(found, cmp);
                    index = cmp.if_else(secret(i), index);
                }

                callback(this, index, found);
            }
            return index;
        }

        /*
         *  Find and replace the first instance with a new share
         */
        remove(share_find, share_replace, callback = function(){}) {
            if (share_find.Zp == null || share_replace.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else {  // find and replace
                for (var i = 0; i < new_length; i++) {
                    var cmp = this.sa[i].seq(share_find);
                    this.sa[i] = cmp.if_else(share_replace, this.sa[i]);
                }

                callback(this);
                return true;
            }
            return false;
        }

        /*
         *  Checks equality with another secret array
         */
        equals(o, callback = function(){}) {
            var equal = secret(0);  // assume not equal
            if (this.sa.length == o.sa.length) {  // equal lengths
                equal = this.sa[0].seq(o.sa[0]);
                for (var i = 1; i < this.sa.length; i++) {
                    // check elements i
                    var cmp = this.sa[i].seq(o.sa[i]);
                    equal = equal.if_else(cmp, equal);
                }

                callback(this, equal);
            }
            return equal;
        }

        /*
         *  Debug function support
         */
        logLEAK(str) {
            for (var i = 0; i < this.sa.length; i++) {
                this.sa[i].logLEAK(str + " Array["+i+"]");
            }
        }

        /**
         *  Regular array operations
         */

        push(share) {
            if (index.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else {  // add the share
                this.sa.push(share);
            }
        }

        pop(share) { return this.sa.pop(); }

        isEmpty() { return this.sa.length == 0; }

        size() { return this.sa.length; }

        reset(array = [], op = null) { this.sa = (new sarray(array, op)).sa; }

        /*  ...
         */
    }

    /*
     * The MPC computation
     */
    exports.compute = function (input = [], index = 0, op = "add", jiff_instance) {
        if (jiff_instance == null) {
            jiff_instance = saved_instance;
        }

        var final_deferred = $.Deferred();
        var final_promise = final_deferred.promise();

        /*** The MPC implementation should go -HERE- ***/

        // Get indices
        var k = jiff_instance.share(index);
        cmp = k[1].sgt(k[2]);
        var i = cmp.if_else(k[2], k[1]);  // min
        var j = cmp.if_else(k[1], k[2]);  // max

        // Create and access new secret array
        var array = new sarray(input, op, function (array) {
            item_i = array.get(i);
            item_j = array.get(j);

            // Open the results
            Promise.all(
                [jiff_instance.open(item_i), jiff_instance.open(item_j)]
            ).then(function (results) {
                final_deferred.resolve(results);
            });
        });

        // Return a promise to the final output(s)
        return final_promise;
    };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

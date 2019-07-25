/*
*  Secret Array Library
*  @param {Array<SecretShare|number>} array - one-dimentional array of secret
*                                            shares or constant values to share
*  @param {string} op - name of secret share operation to create the array
*  @param {function} callback - function to call when the secret array is initialized
*  @return {object} secret array object (array not initialized, use callback)
*/
(function (exports, node) {
    sarray = exports = function (array = [], op, callback = function(){}) {
        var self = {};  // secret array object

        /**
         *  Helper methods
         */

        /*
         *  New secret share from MPC operation from both parties
         */
        var helper_eval = function (a, op = "add") {
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
        var helper_secret = function (a) {
            return (a==0)?eval(0):eval(0).cadd(a);
        }

        /**
         *  Constructor
         *  Set up an array of secret shares
         */
        self.constructor = function (array, op) {
            if (op == null) {  // already secret-shared
                new_sa = array;
            } else {  // create and secret-share the array
                new_sa = [];
                for (var i = 0; i < array.length; i++) {
                    let element = jiff_instance.share(array[i]);
                    new_sa[i] = helper_eval(element, op);
                }
            }
            return {sa: new_sa};
        }
        Object.assign(self, self.constructor(array, op));

        /**
         *  Secret array operations
         */

        /*
         *  Get share at a secret index
         */
        self.get = function (index, callback = function(){}) {
            if (index.Zp == null) {  // public access
                var element = self.sa[i];
            } else {  // secret access
                var element = self.sa[0];
                for (var i = 0; i < self.sa.length; i++) {
                    element = index.ceq(i).if_else(self.sa[i], element);
                }
            }

            callback(self, element);
            return element;
        }

        /*
         *  Set share at a secret index
         */
        self.set = function (share, index, callback = function(){}) {
            if (share.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else if (index.Zp == null) {  // not secret
                console.log("Warning add(): Index not secret");
                self.sa[index] = share;  // set directly
            } else {  // add the share
                for (var i = 0; i < self.sa.length; i++) {
                    self.sa[i] = index.ceq(i).if_else(share, self.sa[i]);
                }

                callback(self);
                return true;
            }
            return false;
        }

        /*
         *  Insert a share at a secret index
         */
        self.insert = function (share, index, callback = function(){}) {
            if (share.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else if (index.Zp == null) {  // not secret
                console.log("Warning add(): Index not secret");
                self.sa.splice(index, 0, share);  // insert directly
            } else {  // insert the share
                var padding = helper_secret(Zp-1);  // dummy share used for if_else
                var copy = self.constructor([padding, ...self.sa, padding]);
                const new_length = self.sa.length + 1;
                for (var i = 0; i < new_length; i++) {
                    var eq = index.ceq(i);  // at the index
                    var lt = index.clt(i);  // past the index
                    self.sa[i] = eq.if_else(
                        share,
                        lt.if_else(
                            copy.sa[i],
                            copy.sa[i+1]
                        )
                    );
                }

                callback(self);
                return true;
            }
            return false;
        }

        /*
         *  Remove a share from a secret index
         */
        self.remove = function (index, callback = function(){}) {
            if (index.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else if (index.Zp == null) {  // not secret
                console.log("Warning add(): Index not secret");
                self.sa.splice(index, 1);  // remove directly
            } else {  // remove the share
                var copy = self.constructor([...self.sa]);
                const new_length = self.sa.length - 1;
                for (var i = 0; i < new_length; i++) {
                    var lteq = index.clt(i);  // at or past the index
                    self.sa[i] = lteq.if_else(
                        copy.sa[i+1],
                        copy.sa[i]
                    );
                }

                callback(self);
                return true;
            }
            return false;
        }

        /*
         *  Checks if a share exists in the array
         */
        self.contains = function (share, callback) {
            return indexOf(share, callback).cneq(Zp-1);
        }

        /*
         *  Finds the index of a share in the array
         */
        self.indexOf = function (share, callback = function(){}) {
            var index = helper_secret(Zp-1);
            if (share.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else {  // search the array
                var found = helper_secret(0);
                for (var i = 0; i < self.sa.length; i++) {
                    var cmp = self.sa[i].seq(share);  // correct index condition
                    found = found.if_else(found, cmp);
                    index = cmp.if_else(helper_secret(i), index);
                }

                callback(self, index, found);
            }
            return index;
        }

        /*
         *  Find and replace the first instance with a new share
         */
        self.replace = function (share_find, share_replace, callback = function(){}) {
            if (share_find.Zp == null || share_replace.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else {  // find and replace
                for (var i = 0; i < new_length; i++) {
                    var cmp = self.sa[i].seq(share_find);
                    self.sa[i] = cmp.if_else(share_replace, self.sa[i]);
                }

                callback(self);
                return true;
            }
            return false;
        }

        /*
         *  Checks equality with another secret array
         */
        self.equals = function (o, callback = function(){}) {
            var equal = helper_secret(0);  // assume not equal
            if (self.sa.length == o.sa.length) {  // equal lengths
                equal = self.sa[0].seq(o.sa[0]);
                for (var i = 1; i < self.sa.length; i++) {
                    // check elements i
                    var cmp = self.sa[i].seq(o.sa[i]);
                    equal = equal.if_else(cmp, equal);
                }

                callback(self, equal);
            }
            return equal;
        }

        /*
         *  Debug function support
         */
        self.logLEAK = function (str) {
            for (var i = 0; i < self.sa.length; i++) {
                self.sa[i].logLEAK(str + " Array["+i+"]");
            }
        }

        /**
         *  Regular array operations
         */

        self.push = function (share) {
            if (index.Zp == null) {  // not a share
                console.log("Error add(): Not a share");
            } else {  // add the share
                self.sa.push(share);
            }
        }

        self.pop = function (share) { return self.sa.pop(); }

        self.isEmpty = function () { return self.sa.length == 0; }

        self.size = function () { return self.sa.length; }

        self.reset = function (array = [], op = null) { Object.assign(self, self.constructor(array, op)); }

        callback(self);
        return self;
    };
}((typeof exports == 'undefined' ? self.sarray = {} : exports), typeof exports !== 'undefined'));

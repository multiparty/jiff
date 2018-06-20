/**
 * This defines a library module for for bignumbers in JIFF.
 * This wraps and exposes the jiff-client-bignumber API. Exposed members can be accessed with jiff_bignumber.&lt;member-name&gt;
 * in browser JS, or by using require('./modules/jiff-client-bignumber').&lt;member-name&gt; as usual in nodejs.
 * @namespace jiff_bignumber
 * @version 1.0
 *
 * FEATURES: supports all of the regular JIFF API.
 *
 * MODULE DESIGN INSTRUCTIONS AND EXPLANATION:
 *     1) write a top-level function like the one here: [i.e. (function(exports, node) { .... })(typeof(exports) ....)]
 *        this function acts as the scope for the module, which forbids name conflicts as well as forbid others from
 *        modifying or messing around with the functions and constants inside. Additionally, it makes the code useable
 *        from the browsers and nodejs.
 *
 *     2) In the very last line replace this.jiff_bignumber = {} with this.jiff_<module_name> = {}. This is the defacto
 *        name space for this module. Calling code on the user-side will use that name (jiff_<module_name>) to access the
 *        functions you choose to expose. For nodejs the name space will be ignored and calling code can use the object
 *        returned by the require() call corresponding to this module.
 *
 *     3) Inside the top-level function, create a function called make_jiff. The function should take two parameters:
 *            (a) base_instance, (b) options.
 *        base_instance: the base instance to wrap the extension around, it can be a basic jiff-client.js instance or
 *            an instance of another extension, you can use this instance to perform the basic operation that build
 *            your modules (sharing of integers, simple operations on ints, etc)
 *        options: should be an object that provides your module with whatever options it requires. The options for
 *            the base_instance will be passed to it prior to calling your modules and may not be inside the options
 *            object, but you can access them using base_instance.
 *
 *     4) If your module requires other extensions be applied to the base instance, you can force this by performing a
 *        a check, by seeing if the required extension name exists in base_instance.modules array. You will need to
 *        add the name of this module to that array as well.
 *
 *     5) Adding functionality: You have two options:
 *            (A) use hooks to modify the functionality of the base instance "in place"
 *                and then return the base instance.
 *            (B) Create a new object that contains the base_instance (perhaps as an attribute named "base"), you will
 *                need to recreate the JIFF API at the new object level. The implementation of this API can use functionality
 *                from base_instance. Return the new object.
 *
 *     6) If you need to override any feature in jiff (change how share work, or how open work, or how beaver_triplets
 *        work etc), look at the hooks documentation to see if it is available as a hook. If it is, your best bet would
 *        be to use hooks on top of the base_instance. Another approach could be to override functions inside the base_instance
 *        or to create a new object with brand new functions (that may or may not refer to base_instance). These approaches
 *        can be mixed.
 *
 *     7) If you want to add additional feature that does not override any other feature in jiff, implement that in a
 *        function under a new appropriate name, make sure to document the function properly.
 *
 *     8) at the end of the top-level function and after make_jiff is done, make sure to have an
 *        if(node) { ... } else { ... } block, in which you expose the make_jiff function.
 *
 * Keep in mind that others may base extensions on your extension, or that clients may want to combine functionality from two extensions
 * together. If you have specific dependencies or if you know that the extension will be incompatible with other extensions, make sure
 * to check inside the .modules array, and throw the appropriate errors.
 */

(function(exports, node) {
    /** Return the maximum of two numbers */
    function max(x, y) {
        return x > y ? x : y;
    }

    // secret share implementation
    function createSecretShare(jiff, share, share_helpers) {

        // share.cadd = function(cst) {
        //     if(share.ready) // if share is ready
        //         return jiff.secret_share(jiff, true, null, self.value + cst, self.holders, self.threshold, self.Zp);
        //
        //     // If the share is not ready, return a promise
        //     var promise = self.promise.then(function() { return (self.value + cst, self.Zp); }, self.error);
        //     return jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
        // }

        var old_add = share.sadd;
        share.sadd = function(o) {
            var result = old_add(o);
            return result.cadd(-1 * jiff.offset);
        }

        var old_cmult = share.cmult;
        share.cmult = function(c) {
            var result = old_cmult(c); // c * (x+o)
            var off = jiff.offset;
            var subvar = jiff.helpers.mod(off * c, jiff.Zp); // c * o
            return result.cadd(-1 * subvar).cadd(off);
        }

        var old_sub = share.ssub;
        share.ssub = function(o) {
            // The offset will cancel with the normal ssub, so we add it back on
            var result = old_sub(o);
            return result.cadd(jiff.offset);
        }

        return share;
    }

    // Take the jiff-client base instance and options for this module, and use them
    // to construct an instance for this module.
    function make_jiff(base_instance, options) {
        var jiff = base_instance;

        // Parse options
        if(options == null) options = {};
        if(options.Zp != null) jiff.Zp = options.Zp;

        // Offset "scales" negative numbers
        jiff.offset = Math.floor(jiff.Zp / 2);

        // Add module name
        jiff.modules.push('negativenumber');

        var old_open = jiff.open;
        jiff.open = function(share, parties, op_ids) {
            var promise = old_open(share, parties, op_ids);

            if (promise == null) { return null }
            else { return promise
            .then(function(v) {
                return v - jiff.offset;
            })

            }

        }

        var old_receive_open = jiff.receive_open;
        jiff.receive_open = function(parties, threshold, Zp, op_ids) {
            return old_receive_open(parties, threshold, Zp, op_ids)
                .then(function(v) {
                    return v - jiff.offset;
                })
        }

        /* HOOKS */
        jiff.hooks.beforeShare.push(
            function(jiff, secret, threshold, receivers_list, senders_list, Zp) {
                return secret + jiff.offset;
            });

        jiff.hooks.createSecretShare.push(
            createSecretShare
        )

        return jiff;
    }

    // Expose the functions that consitute the API for this module.
    exports.make_jiff = make_jiff;

}((typeof exports == 'undefined' ? this.jiff_negativenumber = {} : exports), typeof exports != 'undefined'));

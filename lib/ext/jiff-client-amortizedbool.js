(function (exports, node) {
  if(node) {
    BigNumber = require('bignumber.js');
  }

  const booleans = {or: {_true: 1, _false: null} };
  const defaultZp = new BigNumber("2147483647");

  function amortized_or(o) {
    // define my function :) 
    console.log("OR");
    return o;
  }

  function amortized_and(o) {
    // todo
    console.log('AND');
    return o;
  }

  function amortizedBool(instance, share) {
    console.log('hello!');
    share.amortized_or = amortized_or;
    share.amortized_and = amortized_and;
    return share;
  }

  function parseOptions(base_instance, options) {
    if(options == null) options = {};

    if(options.Zp != null) {
      base_instance.Zp = new BigNumber(options.Zp);
    } else {
      base_instance.Zp = defaultZp;
    }

   booleans.or._false = base_instance.Zp.squareRoot();
   console.log(booleans.or._false);
  }

  function make_jiff(base_instance, options) {
    if (base_instance.modules.indexOf('bignumber') == -1)
      throw "Amortizedbool: base instance must use bignumber";

    // Parse options
    parseOptions(base_instance, options);

    // Add extension to modules
    base_instance.modules.push("amortizedbool");
    
    // Add new functionality
    base_instance.hooks.createSecretShare.push(amortizedBool);

    return base_instance;

  }

  exports.make_jiff = make_jiff;
}((typeof exports == 'undefined' ? this.jiff_amortizedbool = {} : exports), typeof exports != 'undefined'));

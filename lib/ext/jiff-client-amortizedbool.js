(function (exports, node) {

  const booleans = {or: {_true: 1, _false: null}}
  const defaultZp = new BigNumber(2147483647) // 2^31 - 1

  function amortized_or(o) {
    // define my function :) 
  
    console.log('meow');
  }

  function amortized_and(o) {
    // todo
  }

  function amortizedBool(instance, share) {
    share.amortized_or = amortized_or;
    share.amortized_and = amortized_and;
  }

  function parseOptions(base_instance) {
    if(options == null) options = {};

    if(options.Zp != null) {
      base_instance.Zp = options.Zp; 
    } else {
      base_instance.Zp = defaultZp;
    }

   booleans.or._false = base_instance.Zp.squareRoot()

   console.log(booleans.or._false)
  
  }

  function make_jiff(base_instance, options) {
    console.log('hellooooo!!11')
    if (!jiff.modules.contains('bignumber')) {
      // throw some error
    }

    parseOptions(base_instance);

    // Parse options
    

    base_instance.hooks.createSecretShare.push(amortizedBool);
  }

  exports.make_jiff = make_jiff;
}((typeof exports == 'undefined' ? this.jiff_amortizedbool = {} : exports), typeof exports != 'undefined'));
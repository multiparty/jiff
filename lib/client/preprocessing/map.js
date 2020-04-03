module.exports = function (jiffClient) {
  var handlers = require('./handlers.js');

  jiffClient.default_preprocessing_protocols = {
    generate_beaver: jiffClient.protocols.generate_beaver_bgw,
    generate_random_number: jiffClient.protocols.generate_random_number,
    sampling: jiffClient.protocols.rejection_sampling,
    generate_random_bits: jiffClient.protocols.generate_random_bits,
    generate_random_bit: jiffClient.protocols.generate_random_bit_bgw,
    generate_zero: jiffClient.protocols.generate_zero,
    generate_random_and_quotient: jiffClient.protocols.generate_random_and_quotient
  };

  jiffClient.preprocessing_function_map = {
    base: {
      // arithmetic sharing protocols
      'smult': [
        {op: 'open', op_id: ':open1'},
        {op: 'generate_beaver', op_id: ':triplet'},
        {op: 'open', op_id: ':open2'}
      ],
      'sxor_bit': [
        {op: 'smult', op_id: ':smult1'}
      ],
      'slt': [
        {op: 'lt_halfprime', op_id: ':halfprime:1'},
        {op: 'lt_halfprime', op_id: ':halfprime:2'},
        {op: 'lt_halfprime', op_id: ':halfprime:3'},
        {op: 'smult', op_id: ':smult1'},
        {op: 'smult', op_id: ':smult2'}
      ],
      'cgt': [
        {op: 'lt_halfprime', op_id: ':halfprime:1'},
        {op: 'lt_halfprime', op_id: ':halfprime:2'},
        {op: 'smult', op_id: ':smult1'}
      ],
      'clt': [
        {op: 'lt_halfprime', op_id: ':halfprime:1'},
        {op: 'lt_halfprime', op_id: ':halfprime:2'},
        {op: 'smult', op_id: ':smult1'}
      ],
      'lt_halfprime': [
        {op: 'rejection_sampling', op_id: ':sampling', params: {defaultBounds: true}},
        {op: 'smult', op_id: ':smult1'},
        {op: 'bits.cgt', op_id: ':bits.cgt'},
        {op: 'sxor_bit', op_id: ':sxor_bit'},
        {op: 'open', op_id: ':open'}
      ],
      'cneq': [
        {op: 'cpow', op_id: ':cpow', handler: handlers.handler_cpow_Zp_minus_1}
      ],
      'cpow': handlers.dynamic_fast_exponentiation,
      'cdiv': [
        {op: 'cgt', op_id: ':wrap_cgt'},
        {op: 'cgteq', op_id: ':cor1'},
        {op: 'cgteq', op_id: ':cor2'},
        {op: 'smult', op_id: ':smult'},
        {op: 'clt', op_id: ':zero_check'},
        {op: 'smult', op_id: ':zero_it'},
        {op: 'open', op_id: ':open'},
        {op: 'quotient', op_id: ':quotient'}
      ],
      'sdiv': [
        {op: 'bit_decomposition', op_id: ':decomposition1'},
        {op: 'bit_decomposition', op_id: ':decomposition2'},
        {op: 'bits.sdiv', op_id: ':bits.sdiv'}
      ],
      'if_else': [
        {op: 'smult', op_id: ':smult'}
      ],
      // bits protocols
      'bit_decomposition': [
        {op: 'rejection_sampling', op_id: ':sampling', params: {defaultBounds: true}},
        {op: 'bits.csubr', op_id: ':bits.csubr:1'},
        {op: 'bits.csubr', op_id: ':bits.csubr:2'},
        {op: 'if_else', op_id: ':if_else:', count: handlers.decomposition_ifelse_count},
        {op: 'open', op_id: ':open'}
      ],
      // comparisons
      'bits.cgteq': [
        {op: 'smult', op_id: ':smult:', count: handlers.constant_bits_count}
      ],
      'bits.cneq': [
        {op: 'sor_bit', op_id: ':sor_bit:', count: handlers.constant_bits_count}
      ],
      'bits.sneq': [
        {op: 'sxor_bit', op_id: ':sxor_bit:initial'},
        {op: 'sxor_bit', op_id: ':sxor_bit:', count: handlers.choice_bits_count(Math.min, -1)},
        {op: 'sor_bit', op_id: ':sor_bit:', count: handlers.choice_bits_count(Math.max, -1)}
      ],
      'bits.sgteq': [
        {op: 'smult', op_id: ':smult:initial'},
        {op: 'smult', op_id: ':smult1:', count: handlers.choice_bits_count(Math.max, -1)},
        {op: 'sxor_bit', op_id: ':sxor_bit1:', count: handlers.choice_bits_count(Math.min, -1)},
        {op: 'smult', op_id: ':smult2:', count: handlers.choice_bits_count(Math.min, -1)}
      ],
      'bits.sgt': [
        {op: 'bits.sgteq', op_id: ':bits.sgteq'},
        {op: 'bits.sneq', op_id: ':bits.sneq'},
        {op: 'smult', op_id: ':smult'}
      ],
      // constant arithmetic
      'bits.cadd': [
        {op: 'smult', op_id: ':smult:', count: handlers.constant_bits_count},
        {op: 'sxor_bit', op_id: ':sxor_bit:', count: handlers.constant_bits_count}
      ],
      'bits.cmult': handlers.dynamic_bits_cmult,
      'bits.cdivl': handlers.dynamic_bits_cdiv('left'),
      'bits.cdivr': handlers.dynamic_bits_cdiv('right'),
      // secret arithmetic
      'bits.sadd': [
        {op: 'sxor_bit', op_id: ':sxor_bit:initial'},
        {op: 'smult', op_id: ':smult:initial'},
        {op: 'smult', op_id: ':smult1:', count: handlers.choice_bits_count(Math.max, -1)},
        {op: 'sxor_bit', op_id: ':sxor_bit1:', count: handlers.choice_bits_count(Math.max, -1)},
        {op: 'smult', op_id: ':smult2:', count: handlers.choice_bits_count(Math.min, -1)},
        {op: 'sxor_bit', op_id: ':sxor_bit2:', count: handlers.choice_bits_count(Math.min, -1)}
      ],
      'bits.smult': handlers.dynamic_bits_smult,
      'bits.sdiv': handlers.dynamic_bits_sdiv,
      'bits.open': [
        {op: 'open', op_id: ':', count: handlers.bits_count}
      ],
      // refresh/open
      'refresh': [
        {op: 'generate_zero', op_id: ''}
      ],
      'open': [
        {op: 'refresh', op_id: ':refresh'}
      ],
      // generating a random number and its quotient / constant
      'quotient': handlers.dynamic_random_and_quotient,
      // rejection sampling
      'rejection_sampling': handlers.dynamic_rejection_sampling
    }
  };

  // arithmetic protocols
  jiffClient.preprocessing_function_map['base']['sor_bit'] = jiffClient.preprocessing_function_map['base']['sxor_bit'];
  jiffClient.preprocessing_function_map['base']['smod'] = jiffClient.preprocessing_function_map['base']['sdiv'];
  jiffClient.preprocessing_function_map['base']['slteq'] = jiffClient.preprocessing_function_map['base']['slt'];
  jiffClient.preprocessing_function_map['base']['sgteq'] = jiffClient.preprocessing_function_map['base']['slt'];
  jiffClient.preprocessing_function_map['base']['sgt'] = jiffClient.preprocessing_function_map['base']['slt'];
  jiffClient.preprocessing_function_map['base']['clteq'] = jiffClient.preprocessing_function_map['base']['cgt'];
  jiffClient.preprocessing_function_map['base']['cgteq'] = jiffClient.preprocessing_function_map['base']['clt'];
  jiffClient.preprocessing_function_map['base']['seq'] = jiffClient.preprocessing_function_map['base']['cneq'];
  jiffClient.preprocessing_function_map['base']['sneq'] = jiffClient.preprocessing_function_map['base']['cneq'];
  jiffClient.preprocessing_function_map['base']['ceq'] = jiffClient.preprocessing_function_map['base']['cneq'];

  // bits protocols
  jiffClient.preprocessing_function_map['base']['bits.clt'] = jiffClient.preprocessing_function_map['base']['bits.cgteq'];
  jiffClient.preprocessing_function_map['base']['bits.clteq'] = jiffClient.preprocessing_function_map['base']['bits.cgteq'];
  jiffClient.preprocessing_function_map['base']['bits.cgt'] = jiffClient.preprocessing_function_map['base']['bits.cgteq'];
  jiffClient.preprocessing_function_map['base']['bits.ceq'] = jiffClient.preprocessing_function_map['base']['bits.cneq'];
  jiffClient.preprocessing_function_map['base']['bits.slt'] = jiffClient.preprocessing_function_map['base']['bits.sgteq'];
  jiffClient.preprocessing_function_map['base']['bits.slteq'] = jiffClient.preprocessing_function_map['base']['bits.sgt'];
  jiffClient.preprocessing_function_map['base']['bits.seq'] = jiffClient.preprocessing_function_map['base']['bits.sneq'];
  jiffClient.preprocessing_function_map['base']['bits.csubl'] = jiffClient.preprocessing_function_map['base']['bits.cadd'];
  jiffClient.preprocessing_function_map['base']['bits.csubr'] = jiffClient.preprocessing_function_map['base']['bits.cadd'];
  jiffClient.preprocessing_function_map['base']['bits.ssub'] = jiffClient.preprocessing_function_map['base']['bits.sadd'];
};

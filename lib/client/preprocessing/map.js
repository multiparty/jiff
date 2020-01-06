/**
 * maps all primitive operations to the other operations they are dependent on, to be traversed during preprocessing
 * @member {Object} preprocessing_function_map
 * @memberof jiff-instance
 * @instance
 */
jiff.preprocessing_function_map = {
  base: {
    // arithmetic sharing protocols
    'smult': [
      { op: 'generate_beaver', op_id: ':triplet' },
      { op: 'open', op_id: ':open1' },
      { op: 'open', op_id: ':open2' }
    ],
    'sxor_bit': [
      { op: 'smult', op_id: ':smult1' }
    ],
    'slt': [
      { op: 'lt_halfprime', op_id: ':halfprime:1' },
      { op: 'lt_halfprime', op_id: ':halfprime:2' },
      { op: 'lt_halfprime', op_id: ':halfprime:3' },
      { op: 'smult', op_id: ':smult1' },
      { op: 'smult', op_id: ':smult2' }
    ],
    'cgt': [
      { op: 'lt_halfprime', op_id: ':halfprime:1' },
      { op: 'lt_halfprime', op_id: ':halfprime:2' },
      { op: 'smult', op_id: ':smult1' }
    ],
    'clt': [
      { op: 'lt_halfprime', op_id: ':halfprime:1' },
      { op: 'lt_halfprime', op_id: ':halfprime:2' },
      { op: 'smult', op_id: ':smult1' }
    ],
    'lt_halfprime': [
      { op: 'sampling', op_id: ':sampling' },
      { op: 'smult', op_id: ':smult1' },
      { op: 'bits.cgt', op_id: ':bits.cgt' },
      { op: 'sxor_bit', op_id: ':sxor_bit' },
      { op: 'open', op_id: ':open' }
    ],
    'cdiv': [
      { op: 'cgt', op_id: ':wrap_cgt' },
      { op: 'cgteq', op_id: ':cor1' },
      { op: 'cgteq', op_id: ':cor2' },
      { op: 'smult', op_id: ':smult' },
      { op: 'clt', op_id: ':zero_check' },
      { op: 'smult', op_id: ':zero_it' },
      { op: 'open', op_id: ':open' },
      { op: 'generate_random_and_quotient', op_id: ':quotient' }
    ],
    'sdiv': [
      { op: 'bit_decomposition', op_id: ':decomposition1' },
      { op: 'bit_decomposition', op_id: ':decomposition2' },
      { op: 'bits.sdiv', op_id: ':bits.sdiv' }
    ],
    'if_else': [
      { op: 'smult', op_id: ':smult' }
    ],
    // bits protocols
    'bit_decomposition': [
      { op: 'sampling', op_id: ':sampling' },
      { op: 'bits.csubr', op_id: ':bits.csubr:1' },
      { op: 'bits.csubr', op_id: ':bits.csubr:2' },
      { op: 'if_else', op_id: ':if_else:', count: decomposition_ifelse_count },
      { op: 'open', op_id: ':open' }
    ],
    // comparisons
    'bits.cgteq': [
      { op: 'smult', op_id: ':smult:', count: constant_bits_count }
    ],
    'bits.cneq': [
      { op: 'sor_bit', op_id: ':sor_bit:', count: constant_bits_count }
    ],
    'bits.sneq': [
      { op: 'sxor_bit', op_id: ':sxor_bit:initial' },
      { op: 'sxor_bit', op_id: ':sxor_bit:', count: choice_bits_count(Math.min, -1) },
      { op: 'sor_bit', op_id: ':sor_bit:', count: choice_bits_count(Math.max, -1) }
    ],
    'bits.sgteq': [
      { op: 'smult', op_id: ':smult:initial' },
      { op: 'smult', op_id: ':smult1:', count: choice_bits_count(Math.max, -1) },
      { op: 'sxor_bit', op_id: ':sxor_bit1:', count: choice_bits_count(Math.min, -1) },
      { op: 'smult', op_id: ':smult2:', count: choice_bits_count(Math.min, -1) }
    ],
    'bits.sgt': [
      { op: 'bits.sgteq', op_id: ':bits.sgteq'},
      { op: 'bits.sneq', op_id: ':bits.sneq'},
      { op: 'smult', op_id: ':smult'}
    ],
    // constant arithmetic
    'bits.cadd': [
      { op: 'smult', op_id: ':smult:', count: constant_bits_count },
      { op: 'sxor_bit', op_id: ':sxor_bit:', count: constant_bits_count }
    ],
    'bits.cmult': dynamic_bits_cmult,
    'bits.cdivl': dynamic_bits_cdiv('left'),
    'bits.cdivr': dynamic_bits_cdiv('right'),
    // secret arithmetic
    'bits.sadd': [
      { op: 'sxor_bit', op_id: ':sxor_bit:initial' },
      { op: 'smult', op_id: ':smult:initial' },
      { op: 'smult', op_id: ':smult1:', count: choice_bits_count(Math.max, -1) },
      { op: 'sxor_bit', op_id: ':sxor_bit1:', count: choice_bits_count(Math.max, -1) },
      { op: 'smult', op_id: ':smult2:', count: choice_bits_count(Math.min, -1) },
      { op: 'sxor_bit', op_id: ':sxor_bit2:', count: choice_bits_count(Math.min, -1) }
    ],
    'bits.smult': dynamic_bits_smult,
    'bits.sdiv': dynamic_bits_sdiv,
    'bits.open': [
      { op: 'open', op_id: ':', count: bits_count }
    ],
    // refresh/open
    'refresh': [
      { op: 'generate_zero', op_id: '' }
    ],
    'open': [
      { op: 'refresh', op_id: ':refresh' }
    ],
    // generating a random number and its quotient / constant
    '__generate_random_and_quotient': [
      { op: 'bits.cgteq', op_id: ':bits_cgteq' },
      { op: 'if_else', op_id: ':ifelse1' },
      { op: 'if_else', op_id: ':ifelse2' },
      { op: 'sampling', op_id: ':rejection1' }
    ]
  }
};

// arithmetic protocols
jiff.preprocessing_function_map['base']['sor_bit'] = jiff.preprocessing_function_map['base']['sxor_bit'];
jiff.preprocessing_function_map['base']['smod'] = jiff.preprocessing_function_map['base']['sdiv'];
jiff.preprocessing_function_map['base']['slteq'] = jiff.preprocessing_function_map['base']['slt'];
jiff.preprocessing_function_map['base']['sgteq'] = jiff.preprocessing_function_map['base']['slt'];
jiff.preprocessing_function_map['base']['sgt'] = jiff.preprocessing_function_map['base']['slt'];
jiff.preprocessing_function_map['base']['clteq'] = jiff.preprocessing_function_map['base']['cgt'];
jiff.preprocessing_function_map['base']['cgteq'] = jiff.preprocessing_function_map['base']['clt'];
jiff.preprocessing_function_map['base']['seq'] = jiff.preprocessing_function_map['base']['clteq'];
jiff.preprocessing_function_map['base']['sneq'] = jiff.preprocessing_function_map['base']['seq'];
jiff.preprocessing_function_map['base']['ceq'] = jiff.preprocessing_function_map['base']['clteq'];
jiff.preprocessing_function_map['base']['cneq'] = jiff.preprocessing_function_map['base']['ceq'];

// bits protocols
jiff.preprocessing_function_map['base']['bits.clt'] = jiff.preprocessing_function_map['base']['bits.cgteq'];
jiff.preprocessing_function_map['base']['bits.clteq'] = jiff.preprocessing_function_map['base']['bits.cgteq'];
jiff.preprocessing_function_map['base']['bits.cgt'] = jiff.preprocessing_function_map['base']['bits.cgteq'];
jiff.preprocessing_function_map['base']['bits.ceq'] = jiff.preprocessing_function_map['base']['bits.cneq'];
jiff.preprocessing_function_map['base']['bits.slt'] = jiff.preprocessing_function_map['base']['bits.sgteq'];
jiff.preprocessing_function_map['base']['bits.slteq'] = jiff.preprocessing_function_map['base']['bits.sgt'];
jiff.preprocessing_function_map['base']['bits.seq'] = jiff.preprocessing_function_map['base']['bits.sneq'];
jiff.preprocessing_function_map['base']['bits.csubl'] = jiff.preprocessing_function_map['base']['bits.cadd'];
jiff.preprocessing_function_map['base']['bits.csubr'] = jiff.preprocessing_function_map['base']['bits.cadd'];
jiff.preprocessing_function_map['base']['bits.ssub'] = jiff.preprocessing_function_map['base']['bits.sadd'];
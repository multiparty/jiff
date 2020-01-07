/*
 * the default preprocessing protocols for each type of value
 * @member {Object} default_preprocessing_protocols
 * @memberof jiff-instance
 * @instance
 */
jiff.default_preprocessing_protocols = {
  generate_beaver: jiff.protocols.generate_beaver_bgw,
  generate_random_number: jiff.protocols.generate_random_number,
  sampling: jiff.protocols.bits.rejection_sampling,
  generate_random_bits: jiff.protocols.generate_random_bits,
  generate_random_bit: jiff.protocols.generate_random_bit_bgw,
  generate_zero: jiff.protocols.generate_zero,
  generate_random_and_quotient: jiff.protocols.generate_random_and_quotient
};
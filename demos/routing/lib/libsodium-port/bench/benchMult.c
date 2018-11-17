#define BENCHCOUNT 100000

#include <sodium.h>
#include <stdio.h>

void main() {
  if (sodium_init() == -1) {
    return;
  }

  unsigned char hash[crypto_generichash_BYTES];
  unsigned char point[crypto_scalarmult_ed25519_BYTES];
  unsigned char result[crypto_scalarmult_ed25519_BYTES];
  unsigned char scalar[crypto_scalarmult_ed25519_SCALARBYTES];

  // Hash
  crypto_generichash(hash, sizeof hash, "hello", 5, NULL, 0);
  crypto_core_ed25519_from_uniform(point, hash);

  // Benchmarks
  for(int i = 0; i < BENCHCOUNT; i++) {
    randombytes_buf(scalar, sizeof scalar);
    if (crypto_scalarmult_ed25519_noclamp(result, scalar, point) != 0) {
      printf("FAIL SCALAR MULT\n");
      return;
    }
  }

  printf("success scalarMult\n");
}



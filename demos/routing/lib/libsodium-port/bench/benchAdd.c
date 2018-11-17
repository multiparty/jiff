#define BENCHCOUNT 100000

#include <sodium.h>
#include <stdio.h>

void main() {
  if (sodium_init() == -1) {
    return;
  }

  unsigned char hash1[crypto_generichash_BYTES];
  unsigned char hash2[crypto_generichash_BYTES];
  unsigned char point1[crypto_scalarmult_ed25519_BYTES];
  unsigned char point2[crypto_scalarmult_ed25519_BYTES];

  // Hash
  crypto_generichash(hash1, sizeof hash1, "hello", 5, NULL, 0);
  crypto_core_ed25519_from_uniform(point1, hash1);

  crypto_generichash(hash2, sizeof hash2, "world!", 6, NULL, 0);
  crypto_core_ed25519_from_uniform(point2, hash2);

  // Benchmarks
  for(int i = 0; i < BENCHCOUNT; i++) {
    if (crypto_core_ed25519_add(point1, point1, point2) != 0) {
      printf("FAIL ADD\n");
      return;
    }
  }

  printf("success add\n");
}



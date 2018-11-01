#include <sodium.h>
#include <stdio.h>

void main() {
  if (sodium_init() == -1) {
    return;
  }

  unsigned char hash[crypto_generichash_BYTES];
  unsigned char point[crypto_scalarmult_ed25519_BYTES];
  unsigned char point2[crypto_scalarmult_ed25519_BYTES];
  unsigned char point3[crypto_scalarmult_ed25519_BYTES];
  
  int scalar1Ints[32] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2};
  int scalar2Ints[32] = {8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 111, 124, 239, 81, 123, 206, 107, 44, 9, 49, 141, 46, 122, 233, 247};
  
  unsigned char scalar1[crypto_scalarmult_ed25519_SCALARBYTES]; 
  unsigned char scalar2[crypto_scalarmult_ed25519_SCALARBYTES];
  for(int i = 0; i < 32; i++) {
    scalar1[i] = (char) scalar1Ints[32-i-1];
    scalar2[i] = (char) scalar2Ints[32-i-1];
  }

  // Hash
  crypto_generichash(hash, sizeof hash, "Hell1", 5, NULL, 0);
  crypto_core_ed25519_from_uniform(point, hash);

  // multiply by scalars
  int status1 = crypto_scalarmult_ed25519_noclamp(point2, scalar1, point);
  int status2 = crypto_scalarmult_ed25519_noclamp(point3, scalar2, point2);
  if(status1 != 0 || status2 != 0) {
    printf("BIG PROBLEM");
    return;
  }

  for(int i = 0; i < 32; i++) {
    if(point3[i] != point[i]) {
      printf("PROBLEM\n");
      return;
    }
  }
  
  printf("DONE\n");
}



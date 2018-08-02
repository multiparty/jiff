from sys import argv
from random import randint

tests_count = int(argv[1])

min = 0
max = 1030

result = "[\n  "
for i in range(tests_count):
    if i % 6 == 0 and i > 0:
        result = result + "\n  "

    tmp = str(randint(min, max))
    result = result + tmp
    if i < tests_count - 1:
        result = result + ", "

result = result + "\n]"
print result

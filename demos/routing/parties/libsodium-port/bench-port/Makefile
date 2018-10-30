.PHONY: clean

bench.o: bench.c
	gcc bench.c -o bench.o -lsodium

bench: bench.o
	bash -c "time ./bench.o"

test.o: test.c
	gcc test.c -o test.o -lsodium

test: test.o
	bash -c "./test.o"

clean:
	rm -rf *.o



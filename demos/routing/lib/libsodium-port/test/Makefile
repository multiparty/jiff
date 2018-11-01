.PHONY: clean

test.o: test.c
	gcc test.c -o test.o -lsodium

test: test.o
	bash -c "./test.o"
	bash -c "node test.js"

clean:
	rm -rf *.o



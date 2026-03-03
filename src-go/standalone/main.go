package main

import (
	"flag"
	"log"
	"server"
)

func main() {
	spoofAddr := flag.String("spoof", "127.0.0.1:0", "Spoof proxy address to listen on ([ip:]port). Use port 0 for a random free port.")
	flag.Parse()
	log.Fatalln(server.StartServer(*spoofAddr))
}

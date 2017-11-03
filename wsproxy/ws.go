package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/gorilla/websocket"
	"log"
	"net"
	"net/http"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Command struct {
	Id     int      `json:"id"`
	Method string   `json:"method"`
	Params []string `json:"params"`
}

func proxysender(c *websocket.Conn, conn *net.TCPConn, cmdq chan string) {
	mt := websocket.TextMessage
	for {
		cmd := <-cmdq
		fmt.Println("get from command queue:", cmd)
		if cmd == "stop" {
			break
		}
		err := c.WriteMessage(mt, []byte(cmd))
		if err != nil {
			fmt.Println("ws:", err)
			break
		}
		var command Command
		json.Unmarshal([]byte(cmd), &command)
		method := command.Method
		if method == "mining.subscribe" || method == "mining.authorize" || method == "mining.submit" {
			fmt.Println("write to pool:", cmd)
			conn.Write([]byte(cmd))
		}
	}
	conn.Close()
}

func proxyreceiver(conn *net.TCPConn, cmdq chan string) {
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		t := scanner.Text()
		fmt.Println("from pool:", t)
		cmdq <- t
	}
	if err := scanner.Err(); err != nil {
		fmt.Println("from pool:", err)
		return
	}
	cmdq <- "stop"
}

func proxyconnect(host, port string) (conn *net.TCPConn) {
	dest, err := net.ResolveTCPAddr("tcp", host+":"+port)
	if err != nil {
		fmt.Println("resolve:", err)
		return
	}
	src := new(net.TCPAddr)
	var err2 error
	conn, err2 = net.DialTCP("tcp", src, dest)
	if err2 != nil {
		fmt.Println("dial:", err2)
		return
	}
	fmt.Println("dial ok!")
	return
}

func proxymain(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}
	defer c.Close()
	cmdq := make(chan string, 10)
	for {
		_, jsonstr, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			cmdq <- "stop"
			break
		}
		log.Printf("recv: %s", jsonstr)
		var command Command
		json.Unmarshal(jsonstr, &command)
		fmt.Println(command)
		if command.Method == "proxy.connect" && len(command.Params) == 2 {
			host := command.Params[0]
			port := command.Params[1]
			conn := proxyconnect(host, port)
			if conn != nil {
				go proxysender(c, conn, cmdq)
				go proxyreceiver(conn, cmdq)
			}
		} else {
			cmdq <- string(jsonstr)
		}
	}
}

func main() {
	flag.Parse()
	log.SetFlags(0)
	http.HandleFunc("/proxy", proxymain)
	addr := flag.String("addr", "localhost:8088", "http service address")
	log.Fatal(http.ListenAndServe(*addr, nil))
}

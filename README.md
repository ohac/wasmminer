# wasmminer

## build wsproxy and run

```
sudo apt install golang
export GOPATH=~/go
go get gorilla/websocket
cd wsproxy
go build
./wsproxy
```

## run HTTP server

* download caddy and install it
* edit Caddyfile as you like

```
caddy
```

## build cpuminer/wasm and install

* see https://github.com/ohac/cpuminer
* copy `wasmminer.wasm` and `worker_all.js` to js directory

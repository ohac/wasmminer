/*-
 * Copyright 2017 ohac
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 */
var miner = function(work){
  var sha256d_str2 = Module.cwrap('sha256d_str', 'string',
    ['string', 'string', 'string', 'string', 'string']);
  var miner_thread2 = Module.cwrap('miner_thread', 'string',
    ['string', 'string', 'number']);
  console.log('worker: running');
  if (work.jobid) {
    var xnonce2 = '';
    for (var i = 0; i < work.xnonce2len; i++) {
      xnonce2 += '00';
    }
    var merklestr = '';
    for (var i = 0; i < work.merkles.length; i++) {
      merklestr += work.merkles[i];
    }

    var merkleroot = sha256d_str2(
      work.coinb1,
      work.xnonce1,
      xnonce2,
      work.coinb2,
      merklestr);

    console.log('worker: merkleroot = ' + merkleroot);

    var nonce = '00000000';

    var blockheader0 =
      work.version +
      work.prevhash +
      merkleroot +
      work.ntime +
      work.nbits;
    var blockheader = blockheader0 + nonce;

    console.log('worker: blockheader = ' + blockheader);
    var nonce_and_hash = miner_thread2(blockheader, work.diff.toString(),
        work.nonce);
    console.log('worker: found? ' + nonce_and_hash);
    var nah = nonce_and_hash.split(',');
    postMessage([xnonce2, nah[0], nah[1]]);
  }
};

self.addEventListener('message', (message) => {
  var f = function(msg){
    var data = msg.data;
    console.log(data);
    if (data == 'stop') {
      console.log('worker: stop');
      self.close();
    }
    if (data.jobid) {
      miner(data);
    }
  };
  var f2 = function(msg){
    if (Module.ready) {
      f(msg);
    }
    else {
      setTimeout(function(){ f2(msg); }, 10);
    }
  };
  f2(message);
});

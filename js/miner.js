$(function(){

  var setparams = function(){
    var host = location.search.match(/h=(.*?)(&|$)/);
    var port = location.search.match(/p=(.*?)(&|$)/);
    var user = location.search.match(/u=(.*?)(&|$)/);
    var pass = location.search.match(/P=(.*?)(&|$)/);
    if (host) { $('#host').val(host[1]); }
    if (port) { $('#port').val(port[1]); }
    if (user) { $('#username').val(user[1]); }
    if (pass) { $('#password').val(pass[1]); }
  };
  setparams();

  if (false) { // debug code
    var worker = new Worker('/js/worker_all.js');
    worker.onmessage = function(e) {
      var result = e.data;
      console.log('recv from worker: ' + result);
    }
    setTimeout(function(){
      var work = {};
      work['jobid'] = '7b61';
      work['clean'] = false;

      work['prevhash'] = '1e924c35bc128651ad5618755c3ce078' +
                         'e20896b652575e3411106f740000000b';
      work['diff'] = 0.2;
      work['coinb1'] = '010000000100000000000000000000000000000000000000' +
                       '00000000000000000000000000ffffffff270332c80f062f' +
                       '503253482f04d7e2f55908';
      work['coinb2'] = '0d2f6e6f64655374726174756d2f0000000001806e877401' +
                       '0000001976a9143321f2d17da1a0f064ccaa8fea08d50b46' +
                       'c38ed888ac00000000';
      work['xnonce1'] = '07ffb0ec';
      work['merkles'] = [];
      work['version'] = '00000002';
      work['nbits'] = '1d1c8031';
      work['xnonce2len'] = 4;
      work['xnonce2'] = '00000000';
      work['ntime'] = '59f5e2d7';
      work['nonce'] = 0x1b80; // expected nonce: 0x1b8a

      worker.postMessage(work);
    }, 1000); // wait for main of foo.c
  }

  $('#save').click(function(){
    var host = $('#host').val();
    var port = $('#port').val();
    var user = $('#username').val();
    var pass = $('#password').val();
    location.search = '?h=' + host + '&p=' + port + '&u=' + user + '&P=' + pass;
    return false;
  });
  const workers = [];
  var ws = null;
  $('#start').click(function(){
    $('#start').prop('disabled', true);
    $('#stop').prop('disabled', false);
    var auth = false;
    ws = new WebSocket($('#proxy').val());
    ws.onopen = function(ev) {
      console.log('open');
      $('.alert').hide();
      $('#connected').show();

      var msg = {"id": 0, "method": "proxy.connect", "params": []};
      msg.params[0] = $('#host').val();
      msg.params[1] = $('#port').val();
      ws.send(JSON.stringify(msg) + "\n");

      auth = false;
      msg = {"id": 1, "method": "mining.subscribe", "params": []};
      var user_agent = 'webminer/0.1';
      var session_id = null;
      msg.params[0] = user_agent;
      if (session_id) {
        msg.params[1] = session_id;
      }
      ws.send(JSON.stringify(msg) + "\n");
    };
    ws.onclose = function(ev) {
      console.log('close');
      $('.alert').hide();
      $('#disconnected').show();
    };
    var work = {};
    ws.onmessage = function(ev) {
      console.log('message: ' + ev.data);
      $('.alert').hide();
      $('#message').show();
      var doauth = false;
      var json = JSON.parse(ev.data);
      var result = json.result;
      if (result) {
        var res0 = result[0];
        if (json.id == 1) {
          // for bunnymining.work
          var res00 = res0[0];
          if (res00 == 'mining.notify') {
            var sessionid = res0[1];
            var xnonce1 = result[1];
            var xnonce2len = result[2];
            work['sessionid'] = sessionid;
            work['xnonce1'] = xnonce1;
            work['xnonce2len'] = xnonce2len;
            console.log('mining.mining.notify 1: ' + work);
            doauth = true;
          }

          // for jp.lapool.me
          var res000 = res00[0];
          if (res000 == 'mining.set_difficulty') {
            var xnonce1 = result[1];
            var xnonce2len = result[2];
            work['xnonce1'] = xnonce1;
            work['xnonce2len'] = xnonce2len;
            console.log('mining.mining.notify 1: ' + work);
            doauth = true;
          }
        }
      }
      if (json.id == 4) {
        console.log('yay!?');
      }
      var method = json.method;
      var params = json.params;
      if (json.id == null) {
        if (method == 'mining.set_difficulty') {
          var diff = params[0];
          console.log('mining.set_difficulty: ' + diff);
          work['diff'] = diff;
        }
        else if (method == 'mining.notify') {
          work['jobid'] = params[0];
          work['prevhash'] = params[1];
          work['coinb1'] = params[2];
          work['coinb2'] = params[3];
          work['merkles'] = params[4];
          work['version'] = params[5];
          work['nbits'] = params[6];
          work['ntime'] = params[7];
          work['clean'] = params[8];
          console.log('mining.notify 2: ' + work);
          for (var i = 0; i < $('#threads').val(); i++) {
            var worker = workers[i];
            if (worker) {
              worker.terminate();
            }
            worker = new Worker('/js/worker_all.js');
            workers[i] = worker;
            worker.onmessage = function(e) {
              var result = e.data;
              console.log('recv from worker: ' + result);
              var xnonce2 = result[0];
              var nonce = result[1];
              var username = $('#username').val();
              var msg = {"id": 4, "method": "mining.submit",
                "params": [username, work.jobid, xnonce2, work.ntime, nonce]
              };
              ws.send(JSON.stringify(msg) + "\n");
              work['nonce'] = parseInt(nonce, 16) + 1;
              console.log('restart nonce', work['nonce']);
              worker.postMessage($.extend({}, work));
            }
          }
          setTimeout(function(){
            for (var i = 0; i < $('#threads').val(); i++) {
              work['nonce'] = 0x10000000 * i;
              console.log('start nonce', work['nonce']);
              worker.postMessage($.extend({}, work));
            }
          }, 1000); // TODO wait for main of foo.c
        }
      }
      if (!auth && doauth) {
        auth = true;
        msg = {"id": 2, "method": "mining.authorize", "params": []};
        msg.params[0] = $('#username').val();
        msg.params[1] = $('#password').val();
        ws.send(JSON.stringify(msg) + "\n");
      }
    };
    ws.onerror = function(ev) {
      console.log('error');
      $('.alert').hide();
      $('#error').show();
      for (var i = 0; i < workers.length; i++) {
        var worker = workers[i];
        if (worker) {
          worker.postMessage('stop');
          workers[i] = null;
        }
      }
    };
    return false;
  });
  $('#stop').click(function(){
    ws.close();
    for (var i = 0; i < $('#threads').val(); i++) {
      var worker = workers[i];
      if (worker) {
        worker.terminate();
      }
    }
    $('#start').prop('disabled', false);
    $('#stop').prop('disabled', true);
    return false;
  });
});

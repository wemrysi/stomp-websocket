// (c) 2010 Jeff Mesnil -- http://jmesnil.net/

(function(window) {
  
  var Stomp = {};

  Stomp.frame = function(command, headers, body) {
    return {
      command: command,
      headers: headers,
      body: body,
      toString: function() {
        var out = command + '\n';
        if (headers) {
          for (header in headers) {
            if(headers.hasOwnProperty(header)) {
              out = out + header + ':' + headers[header] + '\n';
            }
          }
        }
        out = out + '\n';
        if (body) {
          out = out + body;
        }
        return out;
      }
    }
  };

  function trim(str) {
    return str.replace(/^\s+/g,'').replace(/\s+$/g,'');
  }

  Stomp.unmarshal = function(data) {
    var divider = data.search(/\n\n/),
        headerLines = data.substring(0, divider).split('\n'),
        command = headerLines.shift(),
        headers = {},
        body = '';

    // Parse headers
    var line = idx = null;
    for (var i = 0; i < headerLines.length; i++) {
      line = headerLines[i];
      idx = line.indexOf(':');
      headers[trim(line.substring(0, idx))] = trim(line.substring(idx + 1));
    }

    // Parse body, stopping at the first \0 found.
    // TODO: Add support for content-length header.
    var chr = null;
    for (var i = divider + 2; i < data.length; i++) {
      chr = data.charAt(i);
      if (chr === '\0') {
         break;
      }
      body += chr;
    }

    return Stomp.frame(command, headers, body);
  };

  Stomp.marshal = function(command, headers, body) {
    return Stomp.frame(command, headers, body).toString() + '\0';
  };

  Stomp.WebSocketObjects = ['WebSocket', 'MozWebSocket'];

  Stomp.getWebSocket = function() {
    var wsObjs = Stomp.WebSocketObjects,
        len = wsObjs.length;

    for (var i = 0; i < len; i++) {
      if (typeof(window[wsObjs[i]]) !== 'undefined') {
        return window[wsObjs[i]];
      } 
    } 

    throw "Stomp: WebSocket not found!"
  };
  
  Stomp.client = function (url, keepAliveDelay){
    var that, ws, login, passcode,
        keepAliveIntervalId,
        keepAliveDestination = '/topic/stomp/keepAlive',
        keepAliveDelayMillis = (keepAliveDelay || 10) * 1000,
        counter = 0, // used to index subscribers
        subscriptions = {}; // subscription callbacks indexed by subscriber ID

    function debug(str) {
      if (that.debug) {
        that.debug(str);
      }
    }

    function sendKeepAlive() {
      that.send(keepAliveDestination);
    }

    function onmessage(evt) {
      debug('<<< ' + evt.data);
      var frame = Stomp.unmarshal(evt.data);
      if (frame.command === "CONNECTED") {
        keepAliveIntervalId = setInterval(sendKeepAlive, keepAliveDelayMillis);
        if (that.connectCallback) that.connectCallback(frame);
      } else if (frame.command === "MESSAGE") {
        var onreceive = subscriptions[frame.headers.subscription];
        if (onreceive) {
          onreceive(frame);
        }
      } else if (frame.command === "RECEIPT" && that.onreceipt) {
        that.onreceipt(frame);
      } else if (frame.command === "ERROR" && that.onerror) {
        that.onerror(frame);
      }
    }

    function transmit(command, headers, body) {
      var out = Stomp.marshal(command, headers, body);
      debug(">>> " + out);
      ws.send(out);
    }

    that = {};

    that.connect = function(login_, passcode_, connectCallback, errorCallback) {
      var WS = Stomp.getWebSocket();
      debug("Opening Web Socket...");
      ws = new WS(url);
      ws.onmessage = onmessage;
      ws.onclose   = function() {
        var msg = "Whoops! Lost connection to " + url;
        debug(msg);
        clearInterval(keepAliveIntervalId);
        if (errorCallback) {
          errorCallback(msg);
        }
      };
      ws.onopen    = function() {
        debug('Web Socket Opened...');
        transmit("CONNECT", {login: login, passcode: passcode});
        // connectCallback handler will be called from onmessage when a CONNECTED frame is received
      };
      login = login_;
      passcode = passcode_;
      that.connectCallback = connectCallback;
    };

    that.disconnect = function(disconnectCallback) {
      transmit("DISCONNECT");
      ws.close();
      if (disconnectCallback) {
        disconnectCallback();
      }
    };

    that.send = function(destination, headers, body) {
      var headers = headers || {};
      headers.destination = destination;
      transmit("SEND", headers, body);
    };

    that.subscribe = function(destination, callback, headers) {
      var headers = headers || {};
      var id = "sub-" + counter++;
      headers.destination = destination;
      headers.id = id;
      subscriptions[id] = callback;
      transmit("SUBSCRIBE", headers);
      return id;
    };

    that.unsubscribe = function(id, headers) {
      var headers = headers || {};
      headers.id = id;
      delete subscriptions[id];
      transmit("UNSUBSCRIBE", headers);
    };
    
    that.begin = function(transaction, headers) {
      var headers = headers || {};
      headers.transaction = transaction;
      transmit("BEGIN", headers);
    };

    that.commit = function(transaction, headers) {
      var headers = headers || {};
      headers.transaction = transaction;
      transmit("COMMIT", headers);
    };
    
    that.abort = function(transaction, headers) {
      var headers = headers || {};
      headers.transaction = transaction;
      transmit("ABORT", headers);
    };
    
    that.ack = function(message_id, headers) {
      var headers = headers || {};
      headers["message-id"] = message_id;
      transmit("ACK", headers);
    };
    return that;
  };
  
  window.Stomp = Stomp;

})(window);

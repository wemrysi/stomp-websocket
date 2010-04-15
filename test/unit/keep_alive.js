var defaultKeepAliveDestination = '/topic/stomp/keepAlive',
    keepAliveDelay = 1,
    client = null;

module("Stomp Keep-Alive", {
  setup: function() {
    client = Stomp.client(TEST.url, keepAliveDelay);
    client.debug = TEST.debug;
  },

  teardown: function() {
    client.disconnect();
  }
});

test("Client sends a message to keep-alive destination every keepAliveDelay seconds", 1, function() {
    var keepAliveCount = 0;

    client.connect(TEST.login, TEST.password, function() {
      client.subscribe(defaultKeepAliveDestination, function(frame) {
        keepAliveCount++;
        if (keepAliveCount == 3) {
          start();
          equals(keepAliveCount, 3);
        }
      });
    });

    // Enough time for 3 keep alives, but not 4;
    stop((keepAliveDelay * 4 * 1000) - 500);
});

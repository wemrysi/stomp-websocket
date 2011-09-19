module("Web Sockets");

test("check Web Sockets support", function() {
  ok(Stomp.getWebSocket(), "this browser support Web Sockets");
});

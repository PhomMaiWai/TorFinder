# Sends HTTP/1.1 requests whose message framing is ambiguous to the Caddy edge
# (ASVS 4.2.1) and prints the first line of each answer. Used by the `edge`
# shot in capture-screenshots.js; needs the edge on port 18443 (see there).
import socket, ssl, sys
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
ctx.set_alpn_protocols(["http/1.1"])
cases = {
  "Content-Length and Transfer-Encoding together": "POST /api/auth/login HTTP/1.1\r\nHost: localhost\r\nContent-Length: 4\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n",
  "two different Content-Length values": "POST /api/auth/login HTTP/1.1\r\nHost: localhost\r\nContent-Length: 4\r\nContent-Length: 40\r\n\r\nabcd",
  "unknown Transfer-Encoding": "POST /api/auth/login HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: xchunked\r\n\r\n0\r\n\r\n",
  "bare LF line endings": "GET /search HTTP/1.1\nHost: localhost\n\n",
  "an ordinary request (for comparison)": "GET /api/auth/me HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
}
for name, raw in cases.items():
    s = ctx.wrap_socket(socket.create_connection(("127.0.0.1", 18443), timeout=5), server_hostname="localhost")
    s.sendall(raw.encode())
    try:
        first = s.recv(4096).decode(errors="replace").split("\r\n")[0]
    except Exception as e:
        first = f"(connection closed: {type(e).__name__})"
    s.close()
    print(f"{name}\n  -> {first or '(connection closed, no answer)'}")

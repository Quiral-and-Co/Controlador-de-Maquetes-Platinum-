'use strict';
const assert = require('node:assert/strict');
const net = require('node:net');
const dgram = require('node:dgram');
const { decodeFrame, validateOptions, MarklinCS2Monitor } = require('../marklin-cs2-driver');

assert.deepEqual(validateOptions(), { host:'127.0.0.1', tcpPort:15731, udpPort:15730, timeoutMs:5000 });
assert.throws(() => validateOptions({ tcpPort:70000 }), /tcpPort/);
assert.throws(() => validateOptions({ timeoutMs:10 }), /timeoutMs/);
const frame = Buffer.from([0x00,0x12,0x34,0x56,0x03,0x11,0x22,0x33,0,0,0,0,0]);
const decoded = decodeFrame(frame, 'test');
assert.equal(decoded.ok, true);
assert.equal(decoded.value.canId, 0x00123456);
assert.equal(decoded.value.dlc, 3);
assert.deepEqual(decoded.value.data, [0x11,0x22,0x33]);
assert.equal(decodeFrame(Buffer.alloc(12)).ok, false);
const badDlc = Buffer.from(frame); badDlc[4] = 9;
assert.equal(decodeFrame(badDlc).ok, false);

(async () => {
  const server = net.createServer(socket => {
    // Split the frame to prove TCP stream reassembly.
    socket.write(frame.subarray(0, 5));
    setTimeout(() => socket.write(frame.subarray(5)), 5);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const monitor = new MarklinCS2Monitor({ host:'127.0.0.1', tcpPort:port, timeoutMs:1500 });
  assert.equal(monitor.getStatus().physicalOutputsEnabled, false);
  const seen = new Promise((resolve, reject) => {
    monitor.once('frame', resolve);
    monitor.once('connectionError', reject);
  });
  const status = await monitor.connectTCP();
  assert.equal(status.state, 'CONNECTED_READ_ONLY');
  assert.equal(status.physicalOutputsEnabled, false);
  const received = await seen;
  assert.equal(received.canId, 0x00123456);
  monitor.disconnect();
  await new Promise(resolve => server.close(resolve));
  console.log('PASS: CS2 MCAN frame validation, TCP stream reassembly, receive-only connection and physical-output lockout');
})().catch(error => { console.error(error); process.exitCode = 1; });

'use strict';

/**
 * Märklin CS2 (60214/60215) MCAN network monitor.
 *
 * Safety contract: this module is strictly receive-only. It never writes to a
 * TCP socket and never sends UDP datagrams. It is intended for diagnostics and
 * simulation; it is NOT a locomotive/accessory command driver.
 */
const net = require('node:net');
const dgram = require('node:dgram');
const { EventEmitter } = require('node:events');

const DEFAULTS = Object.freeze({ host: '127.0.0.1', tcpPort: 15731, udpPort: 15730, timeoutMs: 5000 });
const FRAME_LENGTH = 13;

function validateOptions(options = {}) {
  const host = String(options.host ?? DEFAULTS.host).trim();
  const tcpPort = Number(options.tcpPort ?? DEFAULTS.tcpPort);
  const udpPort = Number(options.udpPort ?? DEFAULTS.udpPort);
  const timeoutMs = Number(options.timeoutMs ?? DEFAULTS.timeoutMs);
  if (!host || host.length > 253 || /[\s\r
]/.test(host)) throw new Error('Host CS2 invàlid.');
  for (const [name, value] of [['tcpPort', tcpPort], ['udpPort', udpPort]]) {
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(name + ' ha d’estar entre 1 i 65535.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 60000) throw new Error('timeoutMs ha d’estar entre 250 i 60000.');
  return { host, tcpPort, udpPort, timeoutMs };
}

/** Decode one 13-byte Ethernet MCAN packet (4-byte ID, DLC, 8 data bytes). */
function decodeFrame(packet, source = 'unknown') {
  const bytes = Buffer.isBuffer(packet) ? packet : Buffer.from(packet || []);
  if (bytes.length !== FRAME_LENGTH) return { ok: false, error: 'MCAN exigeix paquets de 13 bytes.', length: bytes.length };
  const dlc = bytes[4];
  if (dlc > 8) return { ok: false, error: 'DLC CAN fora de rang (0..8).', dlc };
  return {
    ok: true,
    value: {
      source,
      canId: bytes.readUInt32BE(0),
      dlc,
      data: [...bytes.subarray(5, 5 + dlc)],
      raw: bytes.toString('hex').match(/../g).join(' ').toUpperCase(),
      receivedAt: new Date().toISOString()
    }
  };
}

class MarklinCS2Monitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = validateOptions(options);
    this.socket = null;
    this.udp = null;
    this.buffer = Buffer.alloc(0);
    this.state = 'DISCONNECTED';
    this.physicalOutputsEnabled = false;
  }

  getStatus() {
    return {
      state: this.state,
      host: this.options.host,
      tcpPort: this.options.tcpPort,
      udpPort: this.options.udpPort,
      physicalOutputsEnabled: false,
      mode: 'READ_ONLY_MONITOR'
    };
  }

  _frame(packet, source) {
    const decoded = decodeFrame(packet, source);
    if (!decoded.ok) { this.emit('invalidFrame', decoded); return; }
    this.emit('frame', decoded.value);
  }

  /** Open a passive TCP connection to the CS2 MCAN endpoint; no bytes are sent. */
  connectTCP() {
    if (this.socket || this.udp) return Promise.reject(new Error('El monitor ja està actiu.'));
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.options.host, port: this.options.tcpPort });
      this.socket = socket;
      let settled = false;
      const timer = setTimeout(() => socket.destroy(new Error('Timeout de connexió CS2.')), this.options.timeoutMs);
      timer.unref?.();
      const fail = error => {
        if (settled) return;
        settled = true; clearTimeout(timer); this.socket = null; this.state = 'DISCONNECTED';
        reject(error);
      };
      socket.once('connect', () => {
        if (settled) return;
        settled = true; clearTimeout(timer); this.state = 'CONNECTED_READ_ONLY';
        this.emit('connected', this.getStatus()); resolve(this.getStatus());
      });
      socket.on('data', chunk => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (this.buffer.length >= FRAME_LENGTH) {
          const frame = this.buffer.subarray(0, FRAME_LENGTH);
          this.buffer = this.buffer.subarray(FRAME_LENGTH);
          this._frame(frame, 'tcp');
        }
      });
      socket.on('error', error => {
        this.emit('connectionError', error);
        if (!settled) fail(error);
      });
      socket.on('close', () => {
        clearTimeout(timer); this.socket = null; this.buffer = Buffer.alloc(0);
        this.state = 'DISCONNECTED'; this.emit('disconnected', this.getStatus());
      });
    });
  }

  /** Listen for CS2 CAN gateway broadcasts on UDP/15730 (same LAN/subnet). */
  listenUDP(options = {}) {
    if (this.socket || this.udp) return Promise.reject(new Error('El monitor ja està actiu.'));
    const bindHost = String(options.bindHost ?? '0.0.0.0');
    const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.udp = udp;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true; this.udp = null; this.state = 'DISCONNECTED';
        udp.close(); reject(new Error('Timeout escoltant broadcasts MCAN UDP.'));
      }, this.options.timeoutMs);
      timer.unref?.();
      let settled = false;
      udp.once('error', error => {
        this.emit('connectionError', error);
        if (!settled) { settled = true; clearTimeout(timer); this.udp = null; reject(error); }
      });
      udp.on('message', packet => this._frame(packet, 'udp'));
      udp.bind(this.options.udpPort, bindHost, () => {
        if (settled) return;
        settled = true; clearTimeout(timer); this.state = 'LISTENING_UDP_READ_ONLY';
        this.emit('connected', this.getStatus()); resolve(this.getStatus());
      });
      udp.on('close', () => {
        this.udp = null; this.state = 'DISCONNECTED'; this.emit('disconnected', this.getStatus());
      });
    });
  }

  disconnect() {
    if (this.socket) this.socket.destroy();
    if (this.udp) this.udp.close();
    if (!this.socket && !this.udp) this.state = 'DISCONNECTED';
    return this.getStatus();
  }
}

module.exports = { DEFAULTS, FRAME_LENGTH, validateOptions, decodeFrame, MarklinCS2Monitor };

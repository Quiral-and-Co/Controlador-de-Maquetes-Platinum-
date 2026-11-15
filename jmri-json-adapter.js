'use strict';

const WebSocket = require('ws');
const { EventEmitter } = require('node:events');

const TURNOUT_STATES = Object.freeze({ CLOSED: 2, THROWN: 4 });
const SENSOR_STATES = Object.freeze({ ACTIVE: 2, INACTIVE: 4, UNKNOWN: 0 });

function safeName(value) {
  const name = String(value || '').trim();
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(name)) throw new Error('Nom JMRI invàlid.');
  return name;
}

class JmriJsonAdapter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.host = options.host || '127.0.0.1';
    this.port = Number(options.port || 12080);
    this.path = options.path || '/json/';
    this.timeoutMs = Number(options.timeoutMs || 5000);
    this.ws = null;
    this.connected = false;
    this.pending = [];
    this._messageHandler = data => this._onMessage(data);
  }

  connect() {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this._connectPromise) return this._connectPromise;
    const url = `ws://${this.host}:${this.port}${this.path}`;
    this._connectPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('Temps d’espera connectant amb el servidor JSON de JMRI.'));
      }, this.timeoutMs);
      ws.once('open', () => {
        clearTimeout(timer);
        this.connected = true;
        ws.on('message', this._messageHandler);
        ws.on('close', () => this._failPending(new Error('Connexió JMRI tancada.')));
        ws.on('error', err => this._failPending(err));
        this.emit('connected');
        resolve();
      });
      ws.once('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    }).finally(() => { this._connectPromise = null; });
    return this._connectPromise;
  }

  _onMessage(raw) {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    this.emit('message', message);
    const data = message?.data || {};
    const index = this.pending.findIndex(p => p.type === message.type && (!p.name || p.name === data.name));
    if (index >= 0) {
      const [pending] = this.pending.splice(index, 1);
      clearTimeout(pending.timer);
      pending.resolve(message);
    }
  }

  _failPending(error) {
    this.connected = false;
    for (const item of this.pending.splice(0)) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    this.emit('disconnected', error);
  }

  async request(type, name, method = 'get', extra = {}) {
    await this.connect();
    const entityName = name ? safeName(name) : undefined;
    const payload = { type, ...(method === 'get' ? {} : { method }), data: { ...(entityName ? { name: entityName } : {}), ...extra } };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.pending.findIndex(p => p.resolve === resolve);
        if (i >= 0) this.pending.splice(i, 1);
        reject(new Error(`JMRI no ha respost a ${type} ${entityName || ''}.`.trim()));
      }, this.timeoutMs);
      this.pending.push({ type, name: entityName, resolve, reject, timer });
      this.ws.send(JSON.stringify(payload), err => {
        if (!err) return;
        const i = this.pending.findIndex(p => p.resolve === resolve);
        if (i >= 0) this.pending.splice(i, 1);
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async getTurnout(systemName) {
    const result = await this.request('turnout', systemName);
    return this._normaliseState(result, 'turnout');
  }

  async getSensor(systemName) {
    const result = await this.request('sensor', systemName);
    return this._normaliseState(result, 'sensor');
  }

  _normaliseState(message, type) {
    if (message.type !== type || !message.data || !Number.isInteger(Number(message.data.state))) {
      throw new Error('Resposta JMRI incompleta o no vàlida.');
    }
    return { name: safeName(message.data.name), state: Number(message.data.state), raw: message.data };
  }

  async setDccTurnout(accessory, requestedState, safety = {}) {
    if (!accessory || accessory.protocol !== 'DCC' || accessory.type !== 'TURNOUT') {
      throw new Error('Aquest adaptador només opera desviaments DCC.');
    }
    if (accessory.verified !== true) throw new Error('Desviament no verificat físicament.');
    if (safety.jmriConnected !== true || !this.connected) throw new Error('JMRI no està connectat.');
    if (safety.power !== 'ON') throw new Error('Alimentació de via no confirmada en ON.');
    if (safety.armed !== true) throw new Error('Control d’accessoris no armat.');
    if (!Object.hasOwn(TURNOUT_STATES, requestedState)) throw new Error('Estat de desviament no vàlid.');
    const name = safeName(accessory.systemName);
    const result = await this.request('turnout', name, 'post', { state: TURNOUT_STATES[requestedState] });
    return this._normaliseState(result, 'turnout');
  }

  close() {
    if (this.ws && this.ws.readyState < WebSocket.CLOSING) this.ws.close();
    this.connected = false;
    this._failPending(new Error('Adaptador JMRI tancat.'));
  }
}

module.exports = { JmriJsonAdapter, TURNOUT_STATES, SENSOR_STATES, safeName };

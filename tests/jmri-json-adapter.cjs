'use strict';
const assert = require('node:assert/strict');
const { WebSocketServer } = require('ws');
const { JmriJsonAdapter, TURNOUT_STATES, safeName } = require('../jmri-json-adapter');

(async () => {
  assert.equal(TURNOUT_STATES.CLOSED, 2);
  assert.equal(TURNOUT_STATES.THROWN, 4);
  assert.throws(() => safeName('../bad'), /invàlid/);

  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  const received = [];
  server.on('connection', socket => socket.on('message', raw => {
    const command = JSON.parse(raw.toString());
    received.push(command);
    const state = command.data.state ?? (command.type === 'sensor' ? 2 : 4);
    socket.send(JSON.stringify({ type: command.type, data: { name: command.data.name, state } }));
  }));

  const adapter = new JmriJsonAdapter({ host: '127.0.0.1', port, timeoutMs: 1000 });
  try {
    await adapter.connect();
    const turnout = await adapter.getTurnout('LT1');
    assert.equal(turnout.name, 'LT1');
    assert.equal(turnout.state, 4);
    const sensor = await adapter.getSensor('IS1');
    assert.equal(sensor.state, 2);

    const accessory = { protocol: 'DCC', type: 'TURNOUT', systemName: 'LT1', verified: true };
    await assert.rejects(adapter.setDccTurnout(accessory, 'THROWN', {
      jmriConnected: true, power: 'ON', armed: false
    }), /no armat/);
    await adapter.setDccTurnout(accessory, 'CLOSED', {
      jmriConnected: true, power: 'ON', armed: true
    });
    assert.equal(received.at(-1).method, 'post');
    assert.equal(received.at(-1).data.state, 2);
    await assert.rejects(adapter.setDccTurnout({ ...accessory, protocol: 'MM2' }, 'CLOSED', {
      jmriConnected: true, power: 'ON', armed: true
    }), /només opera desviaments DCC/);
  } finally {
    adapter.close();
    await new Promise(resolve => server.close(resolve));
  }
  process.stdout.write('JMRI JSON adapter tests passed\n');
})().catch(error => { console.error(error); process.exitCode = 1; });

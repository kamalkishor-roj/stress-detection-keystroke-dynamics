/**
 * mouse-tracker.js
 * Uses uiohook-napi for cross-platform keyboard + mouse events.
 * Returns an EventEmitter with: 'mousemove', 'mouseclick', 'mousescroll'
 */

const { EventEmitter } = require('events');

function mouseEvents() {
  const emitter = new EventEmitter();
  let destroyed = false;

  try {
    const { uIOhook } = require('uiohook-napi');

    uIOhook.on('mousemove', (event) => {
      if (!destroyed) emitter.emit('mousemove', { x: event.x, y: event.y });
    });

    uIOhook.on('mousedown', () => {
      if (!destroyed) emitter.emit('mouseclick');
    });

    uIOhook.on('wheel', () => {
      if (!destroyed) emitter.emit('mousescroll');
    });

    uIOhook.start();

    emitter.destroy = () => {
      destroyed = true;
      try { uIOhook.stop(); } catch (e) {}
    };

  } catch (err) {
    console.warn('uiohook-napi not available:', err.message);
    emitter.destroy = () => { destroyed = true; };
  }

  return emitter;
}

module.exports = { mouseEvents };

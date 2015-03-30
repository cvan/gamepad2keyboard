(function (window, raf, caf) {

var vendors = ['ms', 'moz', 'webkit', 'o'];
for (var i = 0; i < vendors.length && !window[raf]; ++x) {
  window[raf] = window[vendors[x] + 'RequestAnimationFrame'];
  window[caf] = (window[vendors[x] + 'CancelAnimationFrame'] ||
                 window[vendors[x] + 'CancelRequestAnimationFrame']);
}

if (!window[raf]) {
  var queue = [];

  window.setInterval(function () {
    for (var i = 0; i < queue.length; i++) {
      if (queue[i] !== false) {
        queue[i].call(null);
      }
    }

    queue = [];
  }, 1000 / 60);

  window[raf] = function (cb) {
    return queue.push(cb) - 1;
  };
}

if (!window[caf]) {
  window[caf] = function (id) {
    queue[id] = false;
  };
}

function loop(cb) {
  window[raf](function () {
    cb();
    loop(cb);
  });
}

function getJSON(url, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('get', url);
  xhr.onreadystatechange = handler;
  xhr.responseType = 'json';
  xhr.setRequestHeader('Accept', 'application/json');
  xhr.send();

  function handler() {
    if (this.readyState === this.DONE) {
      if (this.status === 200) {
        cb(null, this.response);
      } else {
        var errorMsg = '[getJSON] `' + url + '` failed\nStatus:   ' + this.status;
        if (this.response.message) {
          errorMsg += '\nResponse: ' + this.response.message;
        }
        cb(new Error(errorMsg));
      }
    }
  };
};

function getGamepads() {
  var apis = ['getGamepads', 'webkitGetGamepads', 'webkitGamepads'];
  for (var i = 0; i < apis.length; i++) {
    if (apis[i] in navigator) {
      return navigator[apis[i]]();
    }
  }
  return [];
}


var AXIS_THRESHOLD = 0.25;

var gamepadIdx = 0;
var gamepadContinuePolling = false;
var gamepadConnected = false;
var gamepadActive = false;

// Chrome doesn't have the gamepad events, and we can't
// feature detect them in Firefox unfortunately.
if ('chrome' in window) {
  gamepadContinuePolling = true;
}

window.addEventListener('gamepadconnected', function () {
  gamepadContinuePolling = true;
});

window.addEventListener('gamepaddisconnected', function () {
  gamepadContinuePolling = false;
});


var mapping = {
};

function GamepadDevice(gamepad) {
  ['axes', 'buttons', 'connected', 'id', 'index', 'mapping'].forEach(function (prop) {
    this[prop] = gamepad[prop];
  }.bind(this));
  this.pretty_id = this.id.replace(/\s\s+/g, ' ').toLowerCase();
  this._ids = this._getIds(this.id);
  this.vendor_id = this._ids[0];
  this.product_id = this._ids[0];
}

GamepadDevice.prototype._getIds = function (id) {
  var bits = id.split('-');
  if (bits.length < 2) {
    var match = id.match(/vendor: (\w+) product: (\w+)/i);
    if (!match) {
      return null;
    }

    return match.slice(1);
  }

  return bits.slice(0, 2);
};


var state = {
  buttons: {},
  axes: {}
};

for (var i = 0; i < 17; i++) {
  state.buttons[i] = {
    pressed: false,
    value: 0.0
  };
}

for (var i = 0; i < 4; i++) {
  state.axes[i] = [0.0];
}


var gamepad;
var waitingForAxisEndTimeout;

function poll() {
  loop(function () {
    if (!gamepadContinuePolling) {
      return;
    }

    if (!gamepad) {
      gamepad = getGamepads()[gamepadIdx];
    }

    var gd = gamepad;

    // if (!gamepad) {
    //   return;
    // }

    // var gd = new GamepadDevice(gamepad);

    gd.buttons.forEach(function (button, idx) {
      var buttonState = {
        index: idx,
        pressed: button.pressed,
        value: button.value
      };

      if (state.buttons[idx].pressed !== buttonState.pressed ||
          state.buttons[idx].value !== buttonState.value) {

        console.log('button #%s changed: %o', idx, buttonState);
        if (buttonState.pressed) {
          emit('buttondown', buttonState);
        } else {
          emit('buttonup', buttonState);
          emit('buttonpress', buttonState);
        }

      }

      state.buttons[idx] = buttonState;
    });

    gd.axes.forEach(function (axis, idx) {
      var axisMoveState = {
        index: idx,
        value: axis
      };

      if (Math.abs(axis) > AXIS_THRESHOLD && state.axes[idx].value !== axis) {
        console.log('axis #%s changed: %s', idx, axis);

        emit('axismove', axisMoveState);

        var pending = state.axes['pending.' + idx];

        if (!pending) {
          pending = [];
        }

        pending.push(axis);

        // Reset the queue every 100 seconds.
        clearTimeout(waitingForAxisEndTimeout);

        waitingForAxisEndTimeout = setTimeout(function () {
          var avg = utils.getAverage(pending);
          if (Math.abs(avg) <= AXIS_THRESHOLD) {
          } else {
            if (avg < 0) {
              roundedAvg = Math.floor(avg);
            } else {
              roundedAvg = Math.ceil(avg);
            }
          }

          console.log('axis #%s average: %s', idx, roundedAvg);

          var axisChangeState = {
            type: 'axischange',
            index: idx,
            value: roundedAvg
          };
          emit('axischange', axisChangeState);

          pending = [];
        }, 100);
      }

      state.axes[idx] = axisMoveState;
    });
  });
}

poll();

var listeners = {};

function emit(name, data) {
  if (name in listeners) {
    listeners[name].forEach(function (func) {
      var eventData = utils.extend(data, {type: name});
      func(eventData);
    });
  }
}

function on(name, func) {
  if (name in listeners) {
    listeners[name].push(func);
  } else {
    listeners[name] = [func];
  }
}

function off(name) {
  listeners[name] = [];
}


var utils = {};

utils.defaultsTo = function (value, defaultValue) {
  return typeof value === 'undefined' ? defaultValue : value;
};

utils.getAverage = function (list) {
  var sum = list.reduce(function (a, b) {
    return a + b;
  });
  return sum / list.length;
};

utils.closest = function (el, sel) {
  if (el !== null) {
    return el.matches(sel) ? el :
      (el.querySelector(sel) || utils.closest(el.parentNode, sel));
  }
};

utils.extend = function (origin, add) {
  // Don't do anything if add isn't an object.
  if (!add || typeof add !== 'object') {
    return origin;
  }

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

var KEY_PROPS = [
  'altKey',
  'charCode',
  'ctrlKey',
  'key',
  'keyCode',
  'metaKey',
  'shiftKey',
  'which',
];

var KEYCODES_TO_KEYS = {
  3: 'Cancel',
  6: 'Help',
  8: 'Backspace',
  9: 'Tab',
  12: 'Clear',
  13: 'Enter',
  16: 'Shift',
  17: 'Control',
  18: 'Alt',
  19: 'Pause',
  20: 'CapsLock',
  27: 'Escape',
  28: 'Convert',
  29: 'NonConvert',
  30: 'Accept',
  31: 'ModeChange',
  33: 'PageUp',
  34: 'PageDown',
  35: 'End',
  36: 'Home',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
  41: 'Select',
  42: 'Print',
  43: 'Execute',
  44: 'PrintScreen',
  45: 'Insert',
  46: 'Delete',
  48: ['0', ')'],
  49: ['1', '!'],
  50: ['2', '@'],
  51: ['3', '#'],
  52: ['4', '$'],
  53: ['5', '%'],
  54: ['6', '^'],
  55: ['7', '&'],
  56: ['8', '*'],
  57: ['9', '('],
  91: 'OS',
  93: 'ContextMenu',
  144: 'NumLock',
  145: 'ScrollLock',
  181: 'VolumeMute',
  182: 'VolumeDown',
  183: 'VolumeUp',
  186: [';', ':'],
  187: ['=', '+'],
  188: [',', '<'],
  189: ['-', '_'],
  190: ['.', '>'],
  191: ['/', '?'],
  192: ['`', '~'],
  219: ['[', '{'],
  220: ['\\', '|'],
  221: [']', '}'],
  222: ["'", '"'],
  224: 'Meta',
  225: 'AltGraph',
  246: 'Attn',
  247: 'CrSel',
  248: 'ExSel',
  249: 'EraseEof',
  250: 'Play',
  251: 'ZoomOut',
};

var i = 0;

// Function keys (F1-24).
for (i = 1; i < 25; i++) {
  KEYCODES_TO_KEYS[111 + i] = 'F' + i;
}

// Printable ASCII characters.
var letter = '';
for (i = 65; i < 91; i++) {
  letter = String.fromCharCode(i);
  KEYCODES_TO_KEYS[i] = [letter.toLowerCase(), letter.toUpperCase()];
}

// Polyfill `key` on `KeyboardEvent`.
var testKeyboardEvent = new KeyboardEvent('keydown');
if (!('key' in testKeyboardEvent)) {
  Object.defineProperty(KeyboardEvent.prototype, 'key', {
    get: function (x) {
      var key = KEYCODES_TO_KEYS[this.which || this.keyCode];

      if (Array.isArray(key)) {
        key = key[+this.shiftKey];
      }

      return key;
    }
  });
}


function getSyntheticKeyProps(e) {
  var obj = {};
  KEY_PROPS.forEach(function (prop) {
    obj[prop] = e[prop];
  });
  return obj;
}



var controlsRowTemplate = document.querySelector('#controlsRowTemplate');

var controlsTable = document.querySelector('.controlsTableBody');

var rowNum = 0;

function addNewRow() {
  var tr = document.createElement('tr');
  tr.setAttribute('data-row', rowNum++);
  tr.innerHTML = controlsRowTemplate.innerHTML;
  controlsTable.appendChild(tr);
}

function addNewRowIfNeeded() {
  if (getLastTextbox().value) {
    addNewRow();
  }
}

for (var i = 0; i < 5; i++) {
  addNewRow();
}

var getLastTextbox = function () {
  return document.querySelector('tr:last-child td:last-child input') || {};
};

var captures = {
  keyboard: {},
  gamepad: {}
};


document.body.addEventListener('keypress', function (e) {
  var parentRow = utils.closest(e.target, 'tr');
  var parentRowNum = parentRow.getAttribute('data-row');
  var controlDevice = e.target.getAttribute('data-device');

  if (e.key === 'Backspace' || e.key === 'Delete') {
    captures[controlDevice][parentRowNum] = [];
    e.target.value = '';
  }

  if (controlDevice !== 'keyboard') {
    return;
  }

  if (!(parentRowNum in captures[controlDevice])) {
    captures[controlDevice][parentRowNum] = [];
  }

  var eventProps = getSyntheticKeyProps(e);

  captures[controlDevice][parentRowNum].push(eventProps);

  var capturedKeys = captures[controlDevice][parentRowNum].map(function (x) {
    return x.key;
  });

  e.target.value = capturedKeys.join(' + ');
  addNewRowIfNeeded();

  var nextGamepadTextbox = parentRow.nextSibling.querySelector('input[data-device=gamepad]');
  if (nextGamepadTextbox) {
    nextGamepadTextbox.focus();
  }
  updateMappingOutput();
}, true);


on('buttonpress', function (e) {
  var el = document.activeElement;
  if (!el) {
    return;
  }

  var controlDevice = el.getAttribute('data-device');
  if (controlDevice !== 'gamepad') {
    return;
  }

  var parentRow = utils.closest(el, 'tr');
  var parentRowNum = parentRow.getAttribute('data-row');

  if (!(parentRowNum in captures.gamepad)) {
    captures.gamepad[parentRowNum] = [];
  }

  captures.gamepad[parentRowNum].push(e);

  var capturedKeys = captures.gamepad[parentRowNum].map(function (x) {
    return 'buttons[' + utils.defaultsTo(x.index, 'unknown') + ']';
  });

  el.value = capturedKeys.join(' + ');
  addNewRowIfNeeded();
  var nextKeyboardTextbox = parentRow.querySelector('input[data-device=keyboard]');
  if (nextKeyboardTextbox) {
    nextKeyboardTextbox.focus();
  }
  updateMappingOutput();
});

on('axischange', function (e) {
  var el = document.activeElement;
  if (!el) {
    return;
  }

  var controlDevice = el.getAttribute('data-device');
  if (controlDevice !== 'gamepad') {
    return;
  }

  var parentRow = utils.closest(el, 'tr');
  var parentRowNum = parentRow.getAttribute('data-row');

  if (!(parentRowNum in captures.gamepad)) {
    captures.gamepad[parentRowNum] = [];
  }

  captures.gamepad[parentRowNum].push(e);

  var capturedKeys = captures.gamepad[parentRowNum].map(function (x) {
    return 'axes[' + utils.defaultsTo(x.index, 'unknown') + ']=' + x.value;
  });

  el.value = capturedKeys.join(' + ');
  addNewRowIfNeeded();
  var nextKeyboardTextbox = parentRow.querySelector('input[data-device=keyboard]');
  if (nextKeyboardTextbox) {
    nextKeyboardTextbox.focus();
  }
  updateMappingOutput();
});


var controlsMappingEl = document.querySelector('#controlsMapping');

function updateMappingOutput() {
  var numKeyboardKeys = Object.keys(captures.keyboard).length;
  var numGamepadKeys = Object.keys(captures.gamepad).length;
  var formattedMapping = [];

  for (var i = 0; i < Math.max(numKeyboardKeys, numGamepadKeys); i++) {
    formattedMapping.push([captures.gamepad[i][0], captures.keyboard[i]]);
  }

  controlsMappingEl.value = JSON.stringify(formattedMapping, null, 2);
}

updateMappingOutput();

controlsMappingEl.addEventListener('focus', function () {
  this.select();
});


// getJSON('mappings.json', function (err, data) {
//   if (err) {
//     return alert(err);
//   }

//   console.log(data);
// });



})(this, 'requestAnimationFrame', 'cancelAnimationFrame');

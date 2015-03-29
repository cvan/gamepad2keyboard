(function (window, raf, caf) {

'use strict';

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
  this.gamepad = gamepad;
  this.id = this.gamepad.id;
  this.pretty_id = this.id.replace(/\s\s+/g, '').toLowerCase();
  this._ids = this._getIds(gamepad.id);
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


var state = {};
var gamepad;

function poll() {
  loop(function () {
    if (!gamepadContinuePolling) {
      return;
    }

    if (!gamepad) {
      gamepad = getGamepads()[gamepadIdx];
    }

    if (!gamepad) {
      return;
    }

    var gd = new GamepadDevice(gamepad);

    console.log(gd.vendor_id);


    // TODO: Update state based on buttons and axes.
    state = {};
  });
}

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

// Printable characters.
var letter = '';
for (i = 65; i < 91; i++) {
  letter = String.fromCharCode(i);
  KEYCODES_TO_KEYS[i] = [letter.toLowerCase(), letter.toUpperCase()];
}



// For now this method only works for ASCII characters and emulates the shift
// key state on US keyboard layout.

console.log(KEYCODES_TO_KEYS)


function getSyntheticKeyProps(e) {
  var obj = {};

  KEY_PROPS.forEach(function (prop) {
    obj[prop] = e[prop];
  });

  if (!obj.key) {
    obj.key = KEYCODES_TO_KEYS[obj.which || obj.keyCode];

    if (Array.isArray(obj.key)) {
      obj.key = obj.key[+obj.shiftKey];
    }
  }

  return obj;
}

// window.addEventListener('keydown', function (e) {
//   console.log(e);
// });

// window.addEventListener('keyup', function (e) {
//   console.log(e);
// });

window.addEventListener('keydown', function (e) {
  console.log(getSyntheticKeyProps(e));
});

// collect all the keys during that capture period. play them back.

// getJSON('mappings.json', function (err, data) {
//   if (err) {
//     return alert(err);
//   }

//   console.log(data);
// });


poll();


})(this, 'requestAnimationFrame', 'cancelAnimationFrame');

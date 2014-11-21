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

function getGamepads() {
  var apis = ['getGamepads', 'webkitGetGamepads', 'webkitGamepads'];
  for (var i = 0; i < apis.length; i++) {
    if (apis[i] in navigator) {
      return navigator[apis[i]]();
    }
  }
  return [];
}

// The browser (Firefox only, atm) will fire `gamepadconnected` when a
// gamepad is connected (or was already connected).
if ('ongamepadconnected' in window) {
  window.addEventListener('gamepadconnected', poll);
  window.addEventListener('gamepaddisconnected', poll);
} else {
  poll();
}

var state = {};
var gamepad;

function poll() {
  loop(function () {
    if (!gamepad) {
      // TODO: Handle multiple controllers.
      gamepad = getGamepads()[0];

      if (!gamepad) {
        return;
      }
    }

    // TODO: Update state based on buttons and axes.
    state = {};
  });
}

})(this, 'requestAnimationFrame', 'cancelAnimationFrame');

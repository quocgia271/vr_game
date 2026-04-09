/* Lightweight Web Audio: BGM pad + one-shot SFX (no external files) */
var GameAudio = (function () {
  var ctx = null;
  var bgmGain = null;
  var masterGain = null;
  var bgmOscs = [];
  var bgmInterval = null;

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.35;
      masterGain.connect(ctx.destination);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.12;
      bgmGain.connect(masterGain);
    }
    return ctx;
  }

  function resume() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
  }

  function beep(freq, dur, type, vol) {
    var c = ensureCtx();
    if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = vol != null ? vol : 0.2;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(masterGain);
    o.start(c.currentTime);
    o.stop(c.currentTime + dur + 0.05);
  }

  function playPickup() {
    resume();
    beep(440, 0.06, 'triangle', 0.15);
  }

  function playSnapOk() {
    resume();
    beep(523, 0.08, 'sine', 0.22);
    setTimeout(function () {
      beep(784, 0.12, 'sine', 0.18);
    }, 70);
  }

  function playWrong() {
    resume();
    beep(180, 0.2, 'sawtooth', 0.12);
  }

  function playLevelWin() {
    resume();
    var seq = [392, 494, 587, 784];
    var i = 0;
    function next() {
      if (i >= seq.length) return;
      beep(seq[i], 0.15, 'sine', 0.2);
      i++;
      setTimeout(next, 120);
    }
    next();
  }

  function playVictory() {
    resume();
    var notes = [523, 659, 784, 1047];
    var j = 0;
    function n() {
      if (j >= notes.length) return;
      beep(notes[j], 0.25, 'triangle', 0.22);
      j++;
      setTimeout(n, 150);
    }
    n();
  }

  function stopBgm() {
    var player = document.getElementById('bgm-player');
    if (player && player.components && player.components.sound) {
      player.components.sound.stopSound();
    }
  }

  function startBgm() {
    var player = document.getElementById('bgm-player');
    if (player && player.components && player.components.sound) {
      // Dùng hàm playSound() của A-Frame để kích hoạt nhạc 3D
      player.components.sound.playSound();
    }
  }

  return {
    resume: resume,
    playPickup: playPickup,
    playSnapOk: playSnapOk,
    playWrong: playWrong,
    playLevelWin: playLevelWin,
    playVictory: playVictory,
    startBgm: startBgm,
    stopBgm: stopBgm
  };
})();

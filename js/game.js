/* VR Color Circle — levels, grab/snap, timer */
(function () {
  var activeGrabBall = null; // Viên bi đang bị cầm
  var targetHoldPos = new THREE.Vector3(); // Tọa độ đích (chuột/tia laser chỉ vào)
  var currentHoldPos = new THREE.Vector3(); // Tọa độ hiện tại để Lerp
  var vrGrabHand = null; // Lưu tay VR đang thao tác
  var grabDistance = 0; // Khoảng cách từ tay đến bi lúc vừa chộp
  var LERP_SPEED = 0.35; // Độ mượt (0.1 là mượt trễ, 1.0 là dính chặt)
  var slotOpacities = {}; // Lưu độ đậm của từng ô màu trên bảng
  var wheelCanvasTexture = null; // Biến giữ texture 3D để update liên tục
  var fadeAnimationIds = {}; // THÊM BIẾN NÀY ĐỂ LƯU ID VÒNG LẶP
  var scene;
  var wheelRoot;
  var ballsRoot;
  var camEl;
  var slots = [];
  var balls = [];
  var grabbed = null;
  var mouseGrab = null;
  var currentLevel = 0;
  var modeHard = false;
  var timeLeft = 0;
  var timerId = null;
  var filledMask = {};
  var SNAP_DIST = 0.48;
  var BALL_RADIUS = 0.11;
  /* Wheel height (m); keep in sync with #wheelPlane position Y in index.html */
  var WHEEL_CENTER = { x: 0, y: 1.7, z: -2.05 };
  var WHEEL_RADIUS = 1.02;
  var RING_RADII = [1.02, 0.68, 0.35];
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  var cannonPhysicsOk = false;
  var physicsTickBound = false;
  var pendingPhysicsSnap = [];
  var BALL_PHYS_MASS = 0.42;
  var REST_VEL_SQ = 0.05;
  var STABLE_FRAMES = 14;
  var SNAP_GIVEUP_FRAMES = 120;
  var MOUSE_HOLD_DIST = 0.55;
  var _holdVec = new THREE.Vector3();
  var _releaseWorld = new THREE.Vector3();
  var _handRayOrigin = new THREE.Vector3();
  var _handRayDir = new THREE.Vector3();
  var _grabBallWorld = new THREE.Vector3();
  var _vrLocalGrabPos = new THREE.Vector3();
  var desktopYaw = 0;
  var desktopPitch = 0;
  var rightLookDrag = false;
  var lastRightClientX = 0;
  var lastRightClientY = 0;
  var useDesktopRightLook = false;

  function $(id) {
    return document.getElementById(id);
  }

  function showToast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    
    // === THÊM CODE HIỂN THỊ VR TOAST ===
    var vrToast = $('vrToast');
    var vrToastText = $('vrToastText');
    
    // Đổi dấu tiếng Việt sang không dấu tạm thời (hoặc giữ nguyên nếu font xài tốt)
    var safeMsg = msg.replace(/á/g,'a').replace(/à/g,'a').replace(/ã/g,'a').replace(/ạ/g,'a')
                     .replace(/đ/g,'d').replace(/Đ/g,'D').replace(/ế/g,'e').replace(/ề/g,'e'); 
                     // (Có thể viết 1 hàm bỏ dấu đầy đủ, hoặc truyền vào tiếng Anh)

    if (vrToast && vrToastText) {
      vrToastText.setAttribute('value', safeMsg);
      vrToast.setAttribute('visible', 'true');
    }

    setTimeout(function () {
      t.classList.remove('show');
      if (vrToast) vrToast.setAttribute('visible', 'false');
    }, ms || 2200);
  }
  var levelInstructions = [
    "Thử thách 1: Hãy tìm và chọn các viên bi màu Cấp 1 (Primary).!",
    "Thử thách 2: Rất tốt! Lần này hãy tìm các viên bi màu Cấp 2 (Secondary).",
    "Thử thách 3: Khó nhất đây! Hãy tìm các viên bi màu Bậc 3 (Tertiary) nằm lẫn lộn để hoàn thành bánh xe màu sắc."
  ];

  function showLevelModal(levelIndex, onConfirm) {
    // 1. NẾU ĐANG CHƠI TRONG KÍNH VR
    if (scene && scene.is('vr-mode')) {
      var vrModal = $('vrLevelModal');
      
      if (!vrModal) { // Đề phòng lỗi chưa load kịp HTML
        showToast('Màn ' + (levelIndex + 1) + ': Bắt đầu!', 3000);
        if (onConfirm) onConfirm();
        return;
      }

      // Đổi dấu tiếng Việt sang không dấu (hoặc giữ nguyên nếu bạn đã cài đặt font chuẩn)
      var descVi = levelInstructions[levelIndex];
      var safeDesc = descVi.replace(/á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ/g, 'a')
                           .replace(/é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ/g, 'e')
                           .replace(/í|ì|ỉ|ĩ|ị/g, 'i')
                           .replace(/ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ/g, 'o')
                           .replace(/ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự/g, 'u')
                           .replace(/ý|ỳ|ỷ|ỹ|ỵ/g, 'y')
                           .replace(/đ/g, 'd')
                           .replace(/Á|À|Ả|Ã|Ạ|Ă|Ắ|Ằ|Ẳ|Ẵ|Ặ|Â|Ấ|Ầ|Ẩ|Ẫ|Ậ/g, 'A')
                           .replace(/Đ/g, 'D');

      // Cập nhật Text 3D
      $('vrModalTitle').setAttribute('value', 'Level ' + (levelIndex + 1));
      $('vrModalDesc').setAttribute('value', safeDesc);
      
      // Đưa Modal ra ngang tầm mắt người chơi
      vrModal.setAttribute('visible', 'true');
      
      // Tính toán lại chiều cao theo mắt người chơi
      var camPos = new THREE.Vector3();
      if (camEl && camEl.object3D) {
         camEl.object3D.getWorldPosition(camPos);
         // Đặt Y bằng tầm mắt, Z thụt về trước mặt 1.25 mét
         vrModal.setAttribute('position', '0 ' + camPos.y + ' -1.25');
      } else {
         // Fallback nếu chưa lấy được camera
         vrModal.setAttribute('position', '0 1.6 -1.25');
      }

      // Lắng nghe sự kiện người chơi dùng tia laser bấm "Đã hiểu"
      var btn = $('vrModalBtn');
      var clickHandler = function() {
        btn.removeEventListener('click', clickHandler); // Xoá event sau khi bấm
        vrModal.setAttribute('visible', 'false');
        vrModal.setAttribute('position', '0 -999 0'); // Giấu modal đi
        if (onConfirm) onConfirm();
      };
      btn.addEventListener('click', clickHandler);
      
      return;
    }

    // ==============================================
    // 2. NẾU ĐANG CHƠI TRÊN WEB 2D (Giữ nguyên logic cũ của bạn)
    var modal = $('level-modal');
    $('modal-title').textContent = 'Level ' + (levelIndex + 1);
    $('modal-desc').textContent = levelInstructions[levelIndex];
    
    $('ui-root').classList.add('panel-active'); 
    modal.classList.add('visible');
    
    var btn = $('btnModalClose');
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', function() {
      this.blur();
      if (document.activeElement) {
        document.activeElement.blur();
      }

      modal.classList.remove('visible');
      if ($('panel').style.display === 'none') {
         $('ui-root').classList.remove('panel-active');
      }
      
      window.focus();
      if (scene && scene.canvas) {
        scene.canvas.focus();
      }

      if (onConfirm) onConfirm();
    });
  }
  function setHud() {
    var hud = $('hud');
    var lv = LEVELS[currentLevel];
    if (!lv) return;
    var need = lv.indices.length * 3; 
    var done = 0;
    
    for (var i = 0; i < lv.indices.length; i++) {
      for (var r = 0; r < 3; r++) {
        if (filledMask[lv.indices[i] + '_' + r]) done++;
      }
    }
    
    var line1 = 'Cấp ' + lv.name + ': ' + lv.titleVi + ' (' + lv.subtitleVi + ')';
    var line2 = 'Gắn đúng: ' + done + ' / ' + need;
    var line3 = modeHard ? 'Thời gian: ' + Math.ceil(timeLeft) + 's' : 'Easy — không giới hạn';
    hud.innerHTML = line1 + '<br>' + line2 + '<br><span class="warn">' + line3 + '</span>';
    hud.classList.add('visible');

    // === THÊM CODE CẬP NHẬT VR HUD ===
    var vrHudText = $('vrHudText');
    var vrHudGroup = $('vrHudGroup');
    if (vrHudText && vrHudGroup) {
      // Dùng tiếng Việt không dấu cho an toàn trong VR
      var vrLine1 = 'Cap ' + lv.name + ': ' + lv.subtitleVi;
      var vrLine2 = 'Da gan: ' + done + ' / ' + need;
      var vrLine3 = modeHard ? 'Time: ' + Math.ceil(timeLeft) + 's' : 'Che do: Easy';
      vrHudText.setAttribute('value', vrLine1 + '\n' + vrLine2 + '\n' + vrLine3);
      vrHudGroup.setAttribute('visible', 'true');
    }
  }

  function clearTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function failTime() {
    clearTimer();
    GameAudio.playWrong();
    showToast('Hết giờ! Thử lại (Hard).', 2800);
    resetLevelSame();
  }

  function tickTimer() {
    if (!modeHard) return;
    timeLeft -= 0.25;
    if (timeLeft <= 0) {
      failTime();
      return;
    }
    setHud();
  }

  function startTimerIfHard() {
    clearTimer();
    if (!modeHard) return;
    timeLeft = HARD_TIME_PER_LEVEL_SEC;
    timerId = setInterval(tickTimer, 250);
  }

  function drawWheelCanvas() {
    var canvas = $('wheelCanvas');
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var cx = w / 2;
    var cy = h / 2;
    var r = Math.min(cx, cy) - 8;
    ctx.clearRect(0, 0, w, h);

    var ringFracs = [1.0, 0.72, 0.42];

    for (var i = 0; i < 12; i++) {
      var a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 12;
      var a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 12;

      for (var rIdx = 0; rIdx < 3; rIdx++) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r * ringFracs[rIdx], a0, a1);
        ctx.closePath();
        
        // 1. Vẽ nền xám nhạt (biểu thị ô trống chưa có màu)
        ctx.fillStyle = '#dcdcdc'; 
        ctx.globalAlpha = 1.0;
        ctx.fill();
        
        // 2. Vẽ màu thực tế đè lên với hiệu ứng fade
        var op = slotOpacities[i + '_' + rIdx] || 0;
        if (op > 0) {
          ctx.fillStyle = WHEEL_COLORS[i].hex[rIdx]; 
          ctx.globalAlpha = op;
          ctx.fill();
        }
        
        // Vẽ viền trắng phân cách các ô
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // Vẽ tâm trắng tròn nhỏ ở giữa bánh xe
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    return canvas;
  }

  function applyWheelTexture() {
    var plane = $('wheelPlane');
    var canvas = drawWheelCanvas();
    if (!plane || !canvas) return;

    function paint() {
      var mesh = plane.getObject3D('mesh');
      if (!mesh || !mesh.material) return;
      
      // Lưu texture vào biến toàn cục wheelCanvasTexture
      wheelCanvasTexture = new THREE.CanvasTexture(canvas);
      if (THREE.SRGBColorSpace) wheelCanvasTexture.colorSpace = THREE.SRGBColorSpace;
      wheelCanvasTexture.anisotropy = 4;
      wheelCanvasTexture.needsUpdate = true;
      
      mesh.material.map = wheelCanvasTexture;
      mesh.material.color.setHex(0xffffff);
      mesh.material.needsUpdate = true;
    }

    plane.addEventListener('loaded', paint);
    setTimeout(paint, 50);
  }
  // Đưa toàn bộ bảng màu về màu xám trống
  function resetWheelOpacities() {
    // 1. Dừng toàn bộ các hiệu ứng fade-in đang chạy dở
    for (var key in fadeAnimationIds) {
      if (fadeAnimationIds[key]) {
        cancelAnimationFrame(fadeAnimationIds[key]);
        fadeAnimationIds[key] = null;
      }
    }

    // 2. Đưa toàn bộ độ mờ về 0 (trống)
    for (var i = 0; i < 12; i++) {
      for (var r = 0; r < 3; r++) {
        slotOpacities[i + '_' + r] = 0;
      }
    }
    drawWheelCanvas();
    if (wheelCanvasTexture) wheelCanvasTexture.needsUpdate = true;
  }

  // Chạy hiệu ứng hiện màu từ từ trong 600ms
  function fadeInSlot(index, ringIndex) {
    var key = index + '_' + ringIndex;
    var startTime = performance.now();
    var duration = 600; 

    // Nếu ô này đang có hiệu ứng chạy dở thì hủy luôn để chạy cái mới
    if (fadeAnimationIds[key]) {
      cancelAnimationFrame(fadeAnimationIds[key]);
    }

    function step(time) {
      var progress = (time - startTime) / duration;
      if (progress > 1) progress = 1;
      
      slotOpacities[key] = progress; 
      drawWheelCanvas();
      if (wheelCanvasTexture) wheelCanvasTexture.needsUpdate = true;

      if (progress < 1) {
        fadeAnimationIds[key] = requestAnimationFrame(step);
      } else {
        fadeAnimationIds[key] = null; // Chạy xong thì xóa ID
      }
    }
    
    fadeAnimationIds[key] = requestAnimationFrame(step);
  }

  function slotWorldPosition(index, ringIndex) {
    var theta = Math.PI / 2 - (index + 0.5) * (Math.PI / 6);
    var radius = RING_RADII[ringIndex]; // Lấy bán kính tương ứng với vòng
    var x = WHEEL_CENTER.x + radius * Math.cos(theta);
    var y = WHEEL_CENTER.y + radius * Math.sin(theta);
    var z = WHEEL_CENTER.z;
    return { x: x, y: y, z: z };
  }
  // Cập nhật hàm tạo ô trống (tạo 36 ô thay vì 12)
  function buildSlots() {
    slots = [];
    if (!wheelRoot) return;
    for (var i = 0; i < 12; i++) {
      for (var r = 0; r < 3; r++) {
        var p = slotWorldPosition(i, r);
        var el = document.createElement('a-entity');
        el.setAttribute('position', p.x + ' ' + p.y + ' ' + p.z);
        el.setAttribute('data-slot-index', String(i));
        el.setAttribute('data-ring-index', String(r)); // Đánh dấu vòng nào
        el.setAttribute('data-color-id', WHEEL_COLORS[i].id);
        el.setAttribute('class', 'slot');
        el.setAttribute(
          'geometry',
          'primitive: torus; radius: ' + (BALL_RADIUS + 0.015) + '; radiusTubular: 0.012; segmentsTubular: 6; segmentsRadial: 5'
        );
        el.setAttribute('material', 'color: #ffffff; opacity: 0.35; transparent: true; shader: flat');
        wheelRoot.appendChild(el);
        slots.push({ el: el, index: i, ringIndex: r, filled: false });
      }
    }
  }
  // Đặt hàm này ngay dưới hàm buildSlots() hiện tại
  function buildLabels() {
    if (!wheelRoot) return;
    
    var labelRadius = 1.55; 
    
    for (var i = 0; i < 12; i++) {
      var col = WHEEL_COLORS[i];
      var theta = Math.PI / 2 - (i + 0.5) * (Math.PI / 6);
      
      var x = WHEEL_CENTER.x + labelRadius * Math.cos(theta);
      var y = WHEEL_CENTER.y + labelRadius * Math.sin(theta);
      var z = WHEEL_CENTER.z;
      
      var textEl = document.createElement('a-text');
      textEl.setAttribute('position', x + ' ' + y + ' ' + z);
      textEl.setAttribute('align', 'center');
      textEl.setAttribute('color', '#ffffff');
      
      // CHỈNH SỬA 1: Giảm width từ 3.5 xuống 2.5 để chữ nhỏ lại và thanh mảnh hơn
      textEl.setAttribute('width', '2.5');
      
      // CHỈNH SỬA 2: Chỉ lấy col.id, bỏ phần ghép chuỗi tier ở phía sau
      textEl.setAttribute('value', col.id);
      
      
      wheelRoot.appendChild(textEl);
    }
  }
  function setSlotHighlight() {
    var lv = LEVELS[currentLevel];
    if (!lv) return;
    var active = {};
    for (var a = 0; a < lv.indices.length; a++) active[lv.indices[a]] = true;
    for (var s = 0; s < slots.length; s++) {
      var sl = slots[s];
      // Ẩn hoàn toàn khối lục giác 3D
      sl.el.setAttribute('visible', 'false'); 
    }
  }

  function clearBalls() {
    pendingPhysicsSnap = [];
    while (ballsRoot && ballsRoot.firstChild) {
      ballsRoot.removeChild(ballsRoot.firstChild);
    }
    balls = [];
  }

  function spawnBallsForLevel() {
    clearBalls();
    var ballDataList = [];

    // 1. Gom bi của TẤT CẢ các level từ Level 1 đến Level hiện tại (để làm nghi binh)
    for (var l = 0; l <= currentLevel; l++) {
      var lv = LEVELS[l];
      for (var b = 0; b < lv.indices.length; b++) {
        var idx = lv.indices[b];
        var col = WHEEL_COLORS[idx];
        // Mỗi màu có 3 sắc độ (Vòng ngoài, giữa, trong)
        for (var r = 0; r < 3; r++) {
          ballDataList.push({
            idx: idx,
            ringIndex: r,
            col: col
          });
        }
      }
    }

    // 2. Xáo trộn ngẫu nhiên mảng bi (Fisher-Yates Shuffle)
    for (var i = ballDataList.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = ballDataList[i];
      ballDataList[i] = ballDataList[j];
      ballDataList[j] = temp;
    }

    // 3. Tính toán kích thước lưới ma trận tùy theo số lượng bi
    var totalBalls = ballDataList.length;
    var cols = 3; 
    if (totalBalls > 9 && totalBalls <= 18) cols = 6; // Level 2: 18 bi -> xếp 6 cột 3 hàng
    if (totalBalls > 18) cols = 6;                    // Level 3: 36 bi -> xếp 6 cột 6 hàng
    
    var spacingX = 0.22; // Khoảng cách ngang
    var spacingZ = 0.22; // Khoảng cách dọc
    var startX = -((cols - 1) * spacingX) / 2-1.3; // Căn giữa
    var startZ = -0.8;   // Đẩy lùi ra xa người chơi một chút
    var baseY = 0.4;    // Chiều cao mặt bàn

    // 4. Đổ bi ra bàn
    for (var i = 0; i < totalBalls; i++) {
      var data = ballDataList[i];
      var colIdx = i % cols;
      var rowIdx = Math.floor(i / cols);

      var bx = startX + colIdx * spacingX;
      var bz = startZ - rowIdx * spacingZ;

      var el = document.createElement('a-entity');
      var posStr = bx + ' ' + baseY + ' ' + bz;
      el.setAttribute('position', posStr);
      el.setAttribute('geometry', 'primitive: sphere; radius: ' + BALL_RADIUS);
      el.setAttribute('material', 'color: ' + data.col.hex[data.ringIndex] + '; shader: flat; roughness: 0.4');
      el.setAttribute('class', 'interactable grabbable');
      el.setAttribute('data-color-id', data.col.id);
      el.setAttribute('data-wheel-index', String(data.idx));
      el.setAttribute('data-ring-index', String(data.ringIndex));
      el.setAttribute('data-home', posStr);
      el.setAttribute('shadow', 'cast: true; receive: false');
      ballsRoot.appendChild(el);
      balls.push(el);
    }
  }
  function resetLevelSame() {
    filledMask = {};
    resetWheelOpacities();
    for (var s = 0; s < slots.length; s++) slots[s].filled = false;
    spawnBallsForLevel();
    setSlotHighlight();
    startTimerIfHard();
    setHud();
  }

  function nextLevel() {
    clearTimer();
    GameAudio.playLevelWin();
    
    // Bắn pháo hoa khi qua màn (màu vàng/cam)
    triggerFireworks(false);

    currentLevel++;
    if (currentLevel >= LEVELS.length) {
      $('hud').classList.remove('visible');
      $('hint-bar').classList.remove('visible');
      GameAudio.playVictory();
      
      // BỔ SUNG: Bắn pháo hoa chiến thắng (nhiều màu sắc)
      triggerFireworks(true);

      showToast('Chiến thắng! Hoàn thành cả 3 cấp.', 3500);
      $('panel').style.display = 'block';
      $('ui-root').classList.add('panel-active');
      setVrMenuVisible(true);
      
      // CHỈNH SỬA: Đợi 3 giây cho pháo hoa rơi xong rồi mới pause game
      setTimeout(function() {
        if (scene.pause) scene.pause();
      }, 4000);

      return;
    }
    
    filledMask = {};
    resetWheelOpacities();
    for (var s = 0; s < slots.length; s++) slots[s].filled = false;
    spawnBallsForLevel();
    setSlotHighlight();
    
    // GỌI MODAL CHUYỂN MÀN
    showLevelModal(currentLevel, function() {
      startTimerIfHard();
      setHud();
    });
  }
  // --- THÊM HÀM NÀY VÀO TRONG js/game.js ---
// --- HÀM BẮN PHÁO HOA & PHÁO GIẤY SIÊU RỰC RỠ (Đã nâng cấp) ---
// --- HÀM BẮN PHÁO HOA GỌN GÀNG, RỰC RỠ TẠI BẢNG MÀU ---
// --- HÀM BẮN PHÁO HOA NHỎ, RÕ NÉT, RƠI XUỐNG VÀ FADE OUT ---
// --- HÀM BẮN PHÁO GIẤY: ÍT HẠT, SẮC NÉT, KHÔNG MỜ ---
// --- HÀM BẮN PHÁO HOA LUNG LINH, PHÁT SÁNG, RỰC RỠ ---
// --- HÀM BẮN PHÁO HOA: TÁCH RỜI, NẰM HẲN PHÍA SAU BẢNG MÀU ---
// --- HÀM BẮN PHÁO HOA: TÁCH RỜI, NẰM HẲN PHÍA SAU BẢNG MÀU ---
// --- HÀM BẮN PHÁO HOA: ÍT HẠT, RỜI RẠC, BẮN LÊN TỪ DƯỚI SAU BẢNG ---
function triggerFireworks(isVictory) {
  var wheel = $('wheelRoot');
  if (!wheel) return;

  // Giảm số lượng xuống cực ít (150 hạt lúc qua màn, 600 hạt lúc phá đảo)
  var count = isVictory ? 600 : 150; 
  var colors = [
    '#FF1493', '#00FF00', '#00FFFF', '#FFFF00', 
    '#FF4500', '#FF00FF', '#8A2BE2', '#FFFFFF'
  ].join(',');

  var celebration = document.createElement('a-entity');
  
  // 1. ĐỔI TỌA ĐỘ BẮN: 
  // Y = 0.5 (Nằm thấp ở dưới)
  // Z = -2.5 (Nằm lùi sâu ra phía sau bánh xe màu đang ở -2.05)
  celebration.setAttribute('position', '0 0.5 -7');

  var emitDuration = isVictory ? 1.5 : 0.5;

  celebration.setAttribute('particle-system', {
    preset: 'default',
    color: colors,
    particleCount: count,
    direction: 1, 
    
    // 2. TÁCH RỜI HẠT: Cho các hạt xuất hiện dàn trải trên một đường ngang rộng 3 mét
    positionSpread: '3 0.2 0',

    // 3. LỰC BẮN MẠNH: Đẩy vọt lên cao (Y=10) để trồi lên từ phía sau bảng
    velocityValue: '0 10 0',       
    
    // Độ văng sang 2 bên vừa phải
    velocitySpread: '6 4 0',  
    
    accelerationValue: '0 -5 0', 
    maxAge: 2.5, // Hạt sống lâu hơn để bay cao và rơi xuống    

    // Kích thước hạt hơi to một chút để dễ nhìn thấy khi số lượng ít
    size: '1.5',     
    randomise: true, 
    blending: 1, 
    
    opacity: '1, 0',            
    duration: emitDuration      
  });

  wheel.appendChild(celebration);

  var cleanupDelay = (emitDuration + 2.5) * 1000 + 200; 
  setTimeout(function() {
    if (celebration.parentNode) {
      celebration.parentNode.removeChild(celebration);
    }
  }, cleanupDelay);
}

// --- HÀM 1: TẠO TEXTURE HÌNH TRÒN SẮC NÉT (KHÔNG BÓNG MỜ) ---
function getCircleTexture() {
  var canvas = document.createElement('canvas');
  canvas.width = 64; 
  canvas.height = 64;
  var ctx = canvas.getContext('2d');
  
  // Làm sạch nền (để nền hoàn toàn trong suốt)
  ctx.clearRect(0, 0, 64, 64);
  
  // Vẽ hình tròn cơ bản sắc nét, KHÔNG dùng shadowBlur để tránh lỗi viền
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; // Phải là màu trắng để pha ra đúng mã hexColor
  ctx.fill();
  
  return canvas.toDataURL();
}

// --- HÀM 2: CHẠY HIỆU ỨNG PARTICLE KHI DÁN BI THÀNH CÔNG ---
function triggerSnapEffect(pos, hexColor) {
  var effect = document.createElement('a-entity');
  
  effect.setAttribute('position', pos.x + ' ' + pos.y + ' ' + (pos.z + 0.05));

  effect.setAttribute('particle-system', {
    texture: 'url(' + getCircleTexture() + ')',
    color: hexColor,               // Lấy đúng màu của bi
    
    type: 3,                       // Kiểu 3: Hình đĩa (Disc) - ép hạt sinh ra theo hình tròn
    particleCount: 25,             
    
    // MẸO: Sinh hạt ngẫu nhiên trong một bán kính hình tròn là 0.15 
    // (Thay vì bắt chúng bắn từ tâm ra xa)
    positionSpread: '0.15 0.15 0', 
    
    velocityValue: '0 0 0',        
    velocitySpread: '0.02 0.02 0', // Vận tốc cực nhỏ, gần như chỉ đứng yên tại chỗ
    accelerationValue: '0 0 0',    
    
    maxAge: 0.35,                  // Tồn tại trong thời gian ngắn
    size: '0.15',                  // Kích thước hạt nhỏ gọn
    randomise: true,
    
    // QUAN TRỌNG NHẤT: blending 1 (Normal) giữ nguyên màu gốc, không làm sáng chói
    blending: 1,                   
    opacity: '1, 0',               // Xuất hiện rõ rồi mờ dần
    duration: 0.1                  // Chỉ phụt ra 1 nhịp duy nhất
  });

  var wheel = $('wheelRoot');
  if (wheel) {
    wheel.appendChild(effect);
    setTimeout(function() {
      if (effect.parentNode) effect.parentNode.removeChild(effect);
    }, 1000);
  }
}

  function checkLevelComplete() {
    var lv = LEVELS[currentLevel];
    if (!lv) return;
    for (var i = 0; i < lv.indices.length; i++) {
      for (var r = 0; r < 3; r++) {
        if (!filledMask[lv.indices[i] + '_' + r]) return;
      }
    }
    nextLevel();
  }
  function removePendingForBall(ballEl) {
    for (var pi = pendingPhysicsSnap.length - 1; pi >= 0; pi--) {
      if (pendingPhysicsSnap[pi].el === ballEl) pendingPhysicsSnap.splice(pi, 1);
    }
  }

  function removeBallPhysics(el) {
    if (!el || !el.components || !el.components['dynamic-body']) return;
    el.removeAttribute('dynamic-body');
  }

  function syncPhysicsBodyFromDataHome(el) {
    var h = el.getAttribute('data-home');
    if (!h || !el.body) return;
    var p = h.split(',');
    var x = parseFloat(p[0], 10);
    var y = parseFloat(p[1], 10);
    var z = parseFloat(p[2], 10);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return;
    el.body.position.set(x, y, z);
    if (el.body.previousPosition && el.body.previousPosition.set) {
      el.body.previousPosition.set(x, y, z);
    }
    if (el.body.velocity && el.body.velocity.set) {
      el.body.velocity.set(0, 0, 0);
    }
    if (el.body.angularVelocity && el.body.angularVelocity.set) {
      el.body.angularVelocity.set(0, 0, 0);
    }
  }

  /* syncFromHome: true when spawning / restore palette — false when thả tay (giữ vị trí hiện tại) */
  function addBallPhysics(el, syncFromHome) {
    if (!cannonPhysicsOk || !el) return;
    if (el.getAttribute('data-placed') === '1') return;
    try {
      var fired = false;
      var onBody = function () {
        if (fired) return;
        fired = true;
        el.removeEventListener('body-loaded', onBody);
        if (syncFromHome) syncPhysicsBodyFromDataHome(el);
      };
      el.addEventListener('body-loaded', onBody);
      var s =
  'shape: sphere; sphereRadius: ' +
  BALL_RADIUS +
  '; mass: ' +
  BALL_PHYS_MASS +
  '; linearDamping: 0.1; angularDamping: 0.1; restitution: 0.8';
      el.setAttribute('dynamic-body', s);
      setTimeout(function () {
        if (fired) return;
        fired = true;
        el.removeEventListener('body-loaded', onBody);
        if (syncFromHome && el.body) syncPhysicsBodyFromDataHome(el);
      }, 320);
    } catch (err) {
      console.warn('VR Color Circle: physics error, fallback no-gravity', err);
      cannonPhysicsOk = false;
    }
  }

  function matchSlotForBall(ballEl) {
    var cid = ballEl.getAttribute('data-color-id');
    var widx = parseInt(ballEl.getAttribute('data-wheel-index'), 10);
    var ridx = parseInt(ballEl.getAttribute('data-ring-index'), 10);
    var lv = LEVELS[currentLevel];
    if (!lv) return { type: 'none' };
    
    ballEl.object3D.updateMatrixWorld(true);
    var pos = new THREE.Vector3();
    ballEl.object3D.getWorldPosition(pos);
    
    var best = null;
    var bestD = 999; // Bắt đầu bằng một khoảng cách rất lớn thay vì SNAP_DIST
    
    // THÊM MỚI: Mảng cấu hình khoảng cách hút bi cho 3 vòng (Ngoài, Giữa, Trong cùng)
    // Bạn có thể tinh chỉnh các số này nếu thấy vẫn chưa vừa ý
    var ringSnapDistances = [0.45, 0.28, 0.16]; 
    
    for (var s = 0; s < slots.length; s++) {
      var sl = slots[s];
      if (sl.filled) continue;
      
      var active = false;
      for (var a = 0; a < lv.indices.length; a++) {
        if (lv.indices[a] === sl.index) active = true;
      }
      if (!active) continue;
      
      var sp = new THREE.Vector3();
      sl.el.object3D.updateMatrixWorld(true);
      sl.el.object3D.getWorldPosition(sp);
      
      var d = pos.distanceTo(sp);
      
      // Lấy khoảng cách cho phép tương ứng với vòng của ô đang xét
      var allowedDist = ringSnapDistances[sl.ringIndex];
      
      // Nếu bi nằm trong vùng cho phép của ô này VÀ là ô gần viên bi nhất
      if (d < allowedDist && d < bestD) {
        bestD = d;
        best = sl;
      }
    }
    
    if (!best) return { type: 'none' };
    
    // Kiểm tra xem có gắn đúng MÀU và đúng VÒNG SẮC ĐỘ không
    if (best.index !== widx || best.ringIndex !== ridx || best.el.getAttribute('data-color-id') !== cid) {
      return { type: 'wrong' };
    }
    return { type: 'ok', best: best };
  }

  function applySnapSuccess(ballEl, best) {
    best.filled = true;
    // Lưu lại bằng key: index_ringIndex (ví dụ: "0_2")
    filledMask[best.index + '_' + best.ringIndex] = true; 
    fadeInSlot(best.index, best.ringIndex);
    removeBallPhysics(ballEl);
    ballsRoot.appendChild(ballEl);
    
    var p = slotWorldPosition(best.index, best.ringIndex);
    ballEl.setAttribute('position', p.x + ' ' + p.y + ' ' + (p.z + 0.07));
    var hexColor = WHEEL_COLORS[best.index].hex[best.ringIndex]; // Lấy mã màu của ô/bi
    triggerSnapEffect(p, hexColor);
    ballEl.setAttribute('class', 'interactable');
    ballEl.setAttribute('data-placed', '1');
    GameAudio.playSnapOk();
    setSlotHighlight();
    setHud();
    checkLevelComplete();
  }

  function restoreHomePlain(ballEl) {
    var h = ballEl.getAttribute('data-home');
    if (!h) return;
    var p = h.split(',');
    ballEl.setAttribute('position', p[0] + ' ' + p[1] + ' ' + p[2]);
  }

  function restoreHomePhysics(ballEl) {
    if (ballEl.getAttribute('data-placed') === '1') return;
    removeBallPhysics(ballEl);
    restoreHomePlain(ballEl);
    if (cannonPhysicsOk) {
      setTimeout(function () {
        addBallPhysics(ballEl, true);
      }, 0);
    }
  }

  function trySnapImmediate(ballEl) {
    // --- LOGIC MỚI: Kiểm tra khoảng cách người chơi đến bảng màu ---
    var camPos = new THREE.Vector3();
    camEl.object3D.getWorldPosition(camPos); // Lấy tọa độ thật của người chơi
    
    var boardPos = new THREE.Vector3();
    if ($('wheelPlane') && $('wheelPlane').object3D) {
       $('wheelPlane').object3D.getWorldPosition(boardPos);
    } else {
       // BỔ SUNG THÊM 3 DÒNG NÀY ĐỂ TRÁNH LỖI
       boardPos.set(WHEEL_CENTER.x, WHEEL_CENTER.y, WHEEL_CENTER.z); 
    }
    
    // Tính khoảng cách từ người chơi đến bảng màu (WHEEL_CENTER)
    var distToBoard = camPos.distanceTo(boardPos);
    
    // Khoảng cách tối đa (mét) được phép dán bi. Bạn có thể tăng/giảm số này!
    // Mặc định lúc mới vào game người chơi đứng cách bảng khoảng 2 mét.
    var MAX_INTERACT_DIST = 3.5; 
    
    var m = matchSlotForBall(ballEl);
    
    // Nếu người chơi ở quá xa, ép kết quả thành 'none' (trượt) để bi rơi xuống đất
    if (distToBoard > MAX_INTERACT_DIST) {
        m.type = 'none';
        showToast('Bạn đang đứng quá xa bảng màu! Hãy tiến lại gần.', 2000);
    }
    // ---------------------------------------------------------------

    // Nếu không khớp, gắn sai ô, HOẶC do đứng quá xa
    if (m.type === 'none' || m.type === 'wrong') {
      if (m.type === 'wrong') {
        GameAudio.playWrong();
        showToast('Sai vị trí! Thử ô đúng trên vòng.', 2000);
      }
      
      // Lấy tọa độ lúc vừa nhả tay
      var currentPos = ballEl.getAttribute('position');
      var board = document.getElementById('gameBoard');
      var boardY = board && board.object3D ? board.object3D.position.y : 0;
      var floorY = 0.11 - boardY; // Trừ đi độ lệch của khối gameBoard
      
      // Tạo hiệu ứng rơi thẳng xuống sàn (Y = 0.11)
     // Tạo hiệu ứng rơi thẳng xuống sàn thật
     ballEl.setAttribute('animation', {
      property: 'position',
      to: currentPos.x + ' ' + floorY + ' ' + currentPos.z,
      dur: 300,
      easing: 'easeInQuad'
    });
    return;
    }

    // Xóa hiệu ứng rơi (nếu có) để dán bi vào bảng màu
    ballEl.removeAttribute('animation');
    applySnapSuccess(ballEl, m.best);
  }

  function trySnapAfterSettled(ballEl) {
    if (ballEl.getAttribute('data-placed') === '1') return true;
    var m = matchSlotForBall(ballEl);
    if (m.type === 'none') return false;
    if (m.type === 'wrong') {
      GameAudio.playWrong();
      showToast('Sai vị trí! Thử ô đúng trên vòng.', 2000);
      restoreHomePhysics(ballEl);
      return true;
    }
    applySnapSuccess(ballEl, m.best);
    return true;
  }

  function releaseBall(ballEl) {
    if (!ballsRoot || !ballEl || !ballEl.object3D) return;
    
    // Giữ nguyên logic cập nhật tọa độ khi nhả tay từ controller VR
    if (ballEl.parentNode !== ballsRoot) {
      ballEl.object3D.updateMatrixWorld(true);
      ballEl.object3D.getWorldPosition(_releaseWorld);
      ballsRoot.appendChild(ballEl);
      ballsRoot.object3D.updateMatrixWorld(true);
      ballsRoot.object3D.worldToLocal(_releaseWorld);
      ballEl.setAttribute('position', _releaseWorld.x + ' ' + _releaseWorld.y + ' ' + _releaseWorld.z);
      ballEl.object3D.updateMatrixWorld(true);
    } else {
      ballEl.object3D.updateMatrixWorld(true);
    }

    // --- CHỈ KIỂM TRA VỊ TRÍ BI VÀ BẢNG MÀU (Đã bỏ check khoảng cách người chơi) ---
    var m = matchSlotForBall(ballEl);
    
    // Nếu thả trúng ô và thỏa điều kiện
    if (m.type === 'ok') {
        ballEl.removeAttribute('animation');
        applySnapSuccess(ballEl, m.best);
        return; // Dừng lại! Dán bi thành công, không cho rơi xuống đất nữa.
    } 

    // Nếu thả sai ô (sai màu hoặc sai vòng)
    if (m.type === 'wrong') {
        GameAudio.playWrong();
        showToast('Sai vị trí! Thử ô đúng trên vòng.', 2000);
    }

    // --- NẾU KHÔNG GẮN ĐƯỢC (Thả trượt ra ngoài hoặc sai ô) THÌ CHO RƠI TỰ DO ---
    // Trường hợp lỡ có trục trặc vật lý (fallback)
    if (!cannonPhysicsOk) {
      var currentPos = ballEl.getAttribute('position');
      var board = document.getElementById('gameBoard');
      var boardY = board && board.object3D ? board.object3D.position.y : 0;
      var floorY = 0.11 - boardY; 
      
      ballEl.setAttribute('animation', {
        property: 'position',
        to: currentPos.x + ' ' + floorY + ' ' + currentPos.z,
        dur: 300,
        easing: 'easeInQuad'
      });
      return;
    }

    // Trường hợp hệ thống vật lý bình thường: Gắn trọng lực để rơi nảy tưng tưng
    removePendingForBall(ballEl);
    pendingPhysicsSnap.push({ el: ballEl, stable: 0, giveup: 0 });
    setTimeout(function () {
      addBallPhysics(ballEl, false);
    }, 0);
  }
  function physicsSettlementTick() {
    if (!cannonPhysicsOk || !pendingPhysicsSnap.length) return;
    for (var i = pendingPhysicsSnap.length - 1; i >= 0; i--) {
      var item = pendingPhysicsSnap[i];
      var ball = item.el;
      if (!ball.parentNode || ball.getAttribute('data-placed') === '1') {
        pendingPhysicsSnap.splice(i, 1);
        continue;
      }
      var body = ball.body;
      if (!body) {
        var db = ball.components['dynamic-body'];
        body = db && db.body;
      }
      if (!body || !body.velocity) continue;
      var v = body.velocity;
      var vv = v.x * v.x + v.y * v.y + v.z * v.z;
      if (vv < REST_VEL_SQ) {
        item.stable++;
      } else {
        item.stable = 0;
      }
      if (item.stable < STABLE_FRAMES) continue;
      var done = trySnapAfterSettled(ball);
      if (done) {
        pendingPhysicsSnap.splice(i, 1);
        continue;
      }
      item.giveup++;
      if (item.giveup > SNAP_GIVEUP_FRAMES) {
        pendingPhysicsSnap.splice(i, 1);
      }
    }
  }
  function mainGameTick() {
    physicsSettlementTick(); // Giữ nguyên logic vật lý cũ

    if (activeGrabBall && activeGrabBall.object3D) {
      // 1. Nếu chơi VR, tính tọa độ đích chạy dọc theo tia laser
      if (vrGrabHand && vrGrabHand.object3D) {
        var rc = vrGrabHand.components && vrGrabHand.components.raycaster;
        var rcRay = rc && rc.raycaster && rc.raycaster.ray;
        var safeDistance = (isFinite(grabDistance) && grabDistance > 0.05) ? grabDistance : 1.2;

        // Ở VR thật (Quest), giữ bi làm con của controller giúp bám tay ổn định hơn phép nội suy world/local.
        if (activeGrabBall.parentNode !== vrGrabHand) {
          activeGrabBall.object3D.updateMatrixWorld(true);
          activeGrabBall.object3D.getWorldPosition(_releaseWorld);
          vrGrabHand.appendChild(activeGrabBall);
          vrGrabHand.object3D.updateMatrixWorld(true);
          vrGrabHand.object3D.worldToLocal(_releaseWorld);
          activeGrabBall.setAttribute('position', _releaseWorld.x + ' ' + _releaseWorld.y + ' ' + _releaseWorld.z);
        }

        _vrLocalGrabPos.set(0, 0, -safeDistance);
        activeGrabBall.setAttribute('position', _vrLocalGrabPos.x + ' ' + _vrLocalGrabPos.y + ' ' + _vrLocalGrabPos.z);

        if (rcRay && rcRay.origin && rcRay.direction) {
          // Ưu tiên dùng ray thực tế của controller để đồng nhất với tia laser trên kính thật.
          _handRayOrigin.copy(rcRay.origin);
          _handRayDir.copy(rcRay.direction).normalize();
          targetHoldPos.copy(_handRayOrigin).add(_handRayDir.multiplyScalar(safeDistance));
        } else {
          // Fallback cho emulator/trường hợp raycaster chưa sẵn sàng.
          vrGrabHand.object3D.getWorldPosition(targetHoldPos);
          _handRayDir.set(0, 0, -1).transformDirection(vrGrabHand.object3D.matrixWorld);
          targetHoldPos.add(_handRayDir.multiplyScalar(safeDistance));
        }
        return;
      }

      // 2. Chuyển đổi tọa độ World (targetHoldPos) sang hệ tọa độ của ballsRoot
      ballsRoot.object3D.updateMatrixWorld(true);
      var localTarget = targetHoldPos.clone();
      ballsRoot.object3D.worldToLocal(localTarget);

      // 3. Thực hiện Lerp (Trượt dần từ vị trí hiện tại đến đích)
      currentHoldPos.copy(activeGrabBall.object3D.position);
      currentHoldPos.lerp(localTarget, LERP_SPEED);

      // 4. Áp dụng tọa độ mới
      activeGrabBall.setAttribute('position', currentHoldPos.x + ' ' + currentHoldPos.y + ' ' + currentHoldPos.z);
    }
  }

  function isMobileScene() {
    return (
      typeof AFRAME !== 'undefined' &&
      AFRAME.utils &&
      AFRAME.utils.device &&
      (AFRAME.utils.device.isMobile() || AFRAME.utils.device.isMobileDeviceRequestingDesktopSite())
    );
  }

  function pullDesktopRotFromCamera() {
    if (!camEl || !camEl.object3D) return;
    camEl.object3D.rotation.order = 'YXZ';
    desktopYaw = camEl.object3D.rotation.y;
    desktopPitch = camEl.object3D.rotation.x;
  }

  /* Desktop: tat look-controls (no ghi de rotation moi frame). Xoay bang chuot phai. VR/Mobile: bat look-controls. */
  function applyLookControlsForMode() {
    if (!camEl || !scene) return;
    var vr = scene.is('vr-mode');
    var mobile = isMobileScene();
    if (vr || mobile) {
      useDesktopRightLook = false;
      rightLookDrag = false;
      camEl.setAttribute(
        'look-controls',
        'pointerLockEnabled: false; enabled: true; mouseEnabled: ' +
          (mobile ? 'true' : 'false') +
          '; touchEnabled: ' +
          (mobile ? 'true' : 'false')
      );
    } else {
      useDesktopRightLook = true;
      camEl.setAttribute('look-controls', 'pointerLockEnabled: false; enabled: false');
      pullDesktopRotFromCamera();
      camEl.object3D.rotation.order = 'YXZ';
      camEl.object3D.rotation.y = desktopYaw;
      camEl.object3D.rotation.x = desktopPitch;
    }
  }

  /* Bi la con cua camera: toa do local tu world point tren tia chuot — luon truoc mat, khong lech ballsRoot */
  function updateBallHoldFromMouse(clientX, clientY) {
    if (!mouseGrab || !camEl || !scene || !scene.canvas) return;
    var canvas = scene.canvas;
    var rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    var cam = camEl.components.camera.camera;
    if (!cam) return;
    raycaster.setFromCamera(ndc, cam);
    var o = raycaster.ray.origin;
    var d = raycaster.ray.direction;
    var targetZ = -1.95; 
    var t = (targetZ - o.z) / d.z;
    
    // Lưu tọa độ đích vào biến toàn cục (Tọa độ World)
    if (t > 0 && t < 10) {
      targetHoldPos.set(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t);
    } else {
      targetHoldPos.set(o.x + d.x * 2.0, o.y + d.y * 2.0, o.z + d.z * 2.0);
    }
  }
  function pickBallFromClientXY(clientX, clientY) {
    if (!scene || !camEl) return null;
    var canvas = scene.canvas;
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    var cam = camEl.components.camera.camera;
    raycaster.setFromCamera(ndc, cam);
    raycaster.far = 8;
    var objs = [];
    for (var i = 0; i < balls.length; i++) {
      var o = balls[i].object3D;
      if (o) objs.push(o);
    }
    var hits = raycaster.intersectObjects(objs, true);
    if (!hits.length) return null;
    var el = hits[0].object.el;
    while (el && el.classList && !el.classList.contains('grabbable')) {
      el = el.parentEl || el.parentElement;
    }
    return el;
  }

  function bindHand(handEl) {
    if (!handEl) return;

    // Tách logic bốc bi ra một hàm riêng để dùng chung
    function onGrabStart() {
      GameAudio.resume();
      var rc = handEl.components.raycaster;
      if (!rc) return;
      var hits = rc.intersections;
      if (!hits || !hits.length) return;
      for (var h = 0; h < hits.length; h++) {
        var o = hits[h].object;
        var el = o && o.el;
        if (!el) continue;
        if (!el.classList || !el.classList.contains('grabbable')) continue;
        if (el.getAttribute('data-placed') === '1') continue;
        
        removePendingForBall(el);
        removeBallPhysics(el);
        el.removeAttribute('animation'); // Ngăn bi rơi nếu đang rớt mà chộp lại
        
      
        activeGrabBall = el;
        vrGrabHand = handEl;
        grabDistance = hits[h].distance;
        if (!(isFinite(grabDistance) && grabDistance > 0.05)) {
          var rcRay = rc.raycaster && rc.raycaster.ray;
          if (rcRay && rcRay.origin && el.object3D) {
            el.object3D.getWorldPosition(_grabBallWorld);
            grabDistance = _grabBallWorld.distanceTo(rcRay.origin);
          }
        }
        if (!(isFinite(grabDistance) && grabDistance > 0.05)) {
          grabDistance = 1.2;
        }
        grabbed = { ball: el, hand: handEl };
        GameAudio.playPickup();
        return;
      }
    }

    // Tách logic thả bi ra một hàm riêng
    function onGrabEnd() {
      if (!grabbed || grabbed.hand !== handEl) return;
      var ball = grabbed.ball;
      grabbed = null;
      activeGrabBall = null;
      vrGrabHand = null;
      releaseBall(ball);
    }

    // 1. Lắng nghe tay cầm vật lý (Controller)
    handEl.addEventListener('triggerdown', onGrabStart);
    handEl.addEventListener('triggerup', onGrabEnd);

    // 2. Lắng nghe bàn tay thật (Hand Tracking)
    handEl.addEventListener('pinchstarted', onGrabStart);
    handEl.addEventListener('pinchended', onGrabEnd);
  }

  function bindMouse() {
    var down = false;
    if (!scene.canvas) return;

    scene.canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    scene.canvas.addEventListener('mousedown', function (e) {
      // ĐÃ XÓA 2 DÒNG LỖI Ở ĐÂY
      if (e.button === 2) {
        if (useDesktopRightLook && scene && !scene.is('vr-mode')) {
          rightLookDrag = true;
          lastRightClientX = e.clientX;
          lastRightClientY = e.clientY;
          e.preventDefault();
        }
        return;
      }
      if (e.button !== 0) return;
      if ($('ui-root').classList.contains('panel-active')) return;
      
      var el = pickBallFromClientXY(e.clientX, e.clientY);
      if (!el) return;
      
      e.preventDefault();
      e.stopPropagation();
      down = true;
      
      // CHUYỂN XUỐNG ĐÂY: Chỉ gán khi đã tìm thấy 'el'
      mouseGrab = el;
      activeGrabBall = el;
      
      GameAudio.resume();
      GameAudio.playPickup();
      removePendingForBall(el);
      removeBallPhysics(el);
      
      el.removeAttribute('animation');
      el.setAttribute('visible', true);
      if (el.object3D) el.object3D.visible = true;
      updateBallHoldFromMouse(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', function (e) {
      if (mouseGrab && down) {
        updateBallHoldFromMouse(e.clientX, e.clientY);
      }
      if (rightLookDrag && useDesktopRightLook && scene && !scene.is('vr-mode') && camEl && camEl.object3D) {
        var dx = e.clientX - lastRightClientX;
        var dy = e.clientY - lastRightClientY;
        lastRightClientX = e.clientX;
        lastRightClientY = e.clientY;
        var lim = Math.PI / 2;
        desktopYaw -= dx * 0.002;
        desktopPitch -= dy * 0.002;
        desktopPitch = Math.max(-lim, Math.min(lim, desktopPitch));
        camEl.object3D.rotation.order = 'YXZ';
        camEl.object3D.rotation.y = desktopYaw;
        camEl.object3D.rotation.x = desktopPitch;
      }
    });

    window.addEventListener('mouseup', function (e) {
      // ĐÃ XÓA 2 DÒNG LÀM TRỐNG BIẾN Ở ĐÂY
      if (e.button === 2) {
        rightLookDrag = false;
        return;
      }
      if (e.button !== 0) return;
      if (!down || !mouseGrab) return;
      down = false;
      
      var ball = mouseGrab;
      
      // CHUYỂN XUỐNG ĐÂY: Làm trống biến SAU KHI đã lưu lại viên bi vào biến 'ball'
      mouseGrab = null;
      activeGrabBall = null;
      
      releaseBall(ball);
    });
  }
  function setVrMenuVisible(on) {
    var m = $('vrMenu');
    if (!m) return;
    
    m.setAttribute('visible', on);
    
    // FIX LỖI MENU TÀNG HÌNH CHẮN TIA CLICK
    if (on) {
      // Khi cần hiện, tính toán lại độ cao mắt hiện tại để đưa menu ra trước mặt
      var camPos = new THREE.Vector3();
      if (camEl && camEl.object3D) {
         camEl.object3D.getWorldPosition(camPos);
         m.setAttribute('position', '0 ' + camPos.y + ' -1.15'); 
      } else {
         m.setAttribute('position', '0 1.6 -1.15'); // fallback
      }
    } else {
      // Khi ẩn, vứt nó xuống sâu dưới lòng đất để không cản trở tia raycaster
      m.setAttribute('position', '0 -999 0'); 
    }
  }
  function syncVrHardLabel() {
    var lab = $('vrHardLabel');
    if (lab) {
      lab.setAttribute('value', modeHard ? 'Che do: Hard (Co gio)' : 'Che do: Easy (Khong gio)');
    }
    var pe = $('vrStartPlane');
    if (pe) {
      var texts = pe.querySelectorAll('a-text');
      if (texts[0]) texts[0].setAttribute('value', modeHard ? 'Bat dau (Hard)' : 'Bat dau (Easy)');
    }
  }

  function startGame() {
    GameAudio.resume();
    GameAudio.startBgm();
    $('panel').style.display = 'none';
    setVrMenuVisible(false);
    currentLevel = 0;
    filledMask = {};
    resetWheelOpacities();
    for (var s = 0; s < slots.length; s++) slots[s].filled = false;
    spawnBallsForLevel();
    setSlotHighlight();
    
    // Hiện Modal thay vì chạy game ngay lập tức
    showLevelModal(currentLevel, function() {
      startTimerIfHard();
      setHud();
      $('hint-bar').classList.add('visible');
      if (scene.play) scene.play();
    });
  }
// Hàm tự động cân chỉnh chiều cao khu vực chơi
function adjustHeight() {
  if (!camEl || !camEl.object3D) return;
  var camPos = new THREE.Vector3();
  camEl.object3D.getWorldPosition(camPos);
  
  var currentCamY = camPos.y;
  // Fallback an toàn: nếu kính VR chưa kịp nhận diện sàn, lấy mức 1.6m làm chuẩn
  if (currentCamY < 0.5) currentCamY = 1.6; 
  
  // Tâm bánh xe trong thiết kế đang cao 1.7m. 
  // Trừ đi 1.7 để tìm ra độ lệch cần thiết nâng/hạ toàn bộ gameBoard.
  var targetY = currentCamY - 1.7; 
  
  var board = $('gameBoard');
  if (board) {
    board.setAttribute('position', '0 ' + targetY + ' 0');
  }
}
  function initGame() {
    scene = $('mainScene');
    wheelRoot = $('wheelRoot');
    ballsRoot = $('ballsRoot');
    camEl = $('cam');
    if (!scene) {
      console.error('VR Color Circle: #mainScene not found');
      return;
    }
    drawWheelCanvas();
    applyWheelTexture();
    
    buildSlots();
    buildLabels();
    bindHand($('handRight'));
    bindHand($('handLeft'));
    scene.addEventListener('enter-vr', function() {
      applyLookControlsForMode();
      // Chờ 800ms để kính VR Meta Quest dò xong mặt sàn và chiều cao người chơi
      setTimeout(function() {
        adjustHeight();
        
        // Đưa Menu VR ra ngay chính giữa tầm mắt
        var vrMenu = $('vrMenu');
        var camPos = new THREE.Vector3();
        if (camEl && camEl.object3D) {
          camEl.object3D.getWorldPosition(camPos); // Lấy vị trí thực tế của mắt kính
          if (vrMenu) {
            // Đặt Y bằng tầm mắt, Z thụt về trước mặt 1.2 mét
            vrMenu.setAttribute('position', '0 ' + camPos.y + ' -1.2');
          }
        }
      }, 800); 
    });

    scene.addEventListener('exit-vr', function () {
      setTimeout(applyLookControlsForMode, 120);
      // Khi về lại Web 2D, chỉnh chiều cao lại theo màn hình máy tính
      setTimeout(adjustHeight, 200); 
    });

    // VÀ THÊM DÒNG NÀY VÀO CUỐI CÙNG CỦA HÀM initGame() (ngay trên dấu ngoặc nhọn kết thúc hàm):
    setTimeout(adjustHeight, 200);
    scene.addEventListener('loaded', function () {
      /* aframe-physics-system (Cannon) hien khong tuong thich A-Frame 1.6 / Three r164 — loi getMaterial, driver */
      cannonPhysicsOk = true;
      applyLookControlsForMode();
      applyWheelTexture();
      bindMouse();
      if (!physicsTickBound) {
        physicsTickBound = true;
        
        // Kích hoạt vòng lặp render chuẩn của trình duyệt
        function gameLoop() {
          mainGameTick();
          requestAnimationFrame(gameLoop);
        }
        gameLoop(); 
      }
      if (scene.pause) scene.pause();
    });
    $('btnStart').addEventListener('click', function () {
      var mhRadio = $('modeHard');
      modeHard = !!(mhRadio && mhRadio.checked);
      syncVrHardLabel();
      startGame();
    });
    function onVrStart() {
      var mhR = $('modeHard');
      modeHard = !!(mhR && mhR.checked);
      syncVrHardLabel();
      startGame();
    }
    var vsp = $('vrStartPlane');
    if (vsp) {
      vsp.addEventListener('click', onVrStart);
      var st = vsp.querySelectorAll('a-text.interactable');
      for (var si = 0; si < st.length; si++) st[si].addEventListener('click', onVrStart);
    }
    function onVrHardToggle() {
      modeHard = !modeHard;
      if ($('modeEasy')) $('modeEasy').checked = !modeHard;
      if ($('modeHard')) $('modeHard').checked = modeHard;
      syncVrHardLabel();
    }
    var vhp = $('vrHardPlane');
    if (vhp) {
      vhp.addEventListener('click', onVrHardToggle);
      var hl = $('vrHardLabel');
      if (hl) hl.addEventListener('click', onVrHardToggle);
    }
    syncVrHardLabel();
    $('btnEnterVr').addEventListener('click', function () {
      GameAudio.resume();
      if (scene.enterVR) scene.enterVR();
    });
    var me = $('modeEasy');
    var mh = $('modeHard');
    if (me) {
      me.addEventListener('change', function () {
        if (me.checked) {
          modeHard = false;
          syncVrHardLabel();
        }
      });
    }
    if (mh) {
      mh.addEventListener('change', function () {
        if (mh.checked) {
          modeHard = true;
          syncVrHardLabel();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
})();

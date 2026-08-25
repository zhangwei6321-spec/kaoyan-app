(function () {
  'use strict';

  // ---------- 存储工具 ----------
  var STORE_KEY = 'kaoyan_app_v1';
  var DEFAULTS = {
    targets: [
      { id: 'kaoyan', name: '考研', date: '2026-12-19', fixed: true },
      { id: 'guokao', name: '国考', date: '2026-11-28', fixed: true }
    ],
    checkins: [],          // {id,name,createdAt}
    records: {},           // {'YYYY-MM-DD': {checkinId:true}}
    timeLog: {},           // {'YYYY-MM-DD': seconds}
    pomodoro: { work: 25, short: 5, long: 15, longEvery: 4 }
  };

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      var s = JSON.parse(raw);
      // 合并缺省，防止旧数据缺字段
      if (!s.targets) s.targets = DEFAULTS.targets;
      if (!s.checkins) s.checkins = [];
      if (!s.records) s.records = {};
      if (!s.timeLog) s.timeLog = {};
      if (!s.pomodoro) s.pomodoro = DEFAULTS.pomodoro;
      return s;
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---------- 日期工具 ----------
  function todayStr(d) {
    d = d || new Date();
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  }
  function daysBetween(aStr, bStr) {
    var a = new Date(aStr + 'T00:00:00');
    var b = new Date(bStr + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }
  function fmtDuration(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var pad = function (n) { return ('0' + n).slice(-2); };
    if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
    return pad(m) + ':' + pad(s);
  }
  function fmtHM(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + '小时' + m + '分';
    var s = sec % 60;
    if (m > 0) return m + '分' + s + '秒';
    return s + '秒';
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- 全局计时器（用于累计每日时长）----------
  var activeTimer = null; // {mode, running, startTs, baseElapsed, total(倒计时总秒), label}
  setInterval(tickTimer, 250);

  function tickTimer() {
    if (!activeTimer || !activeTimer.running) return;
    var now = Date.now();
    if (activeTimer.mode === 'up') {
      activeTimer.elapsed = activeTimer.baseElapsed + (now - activeTimer.startTs) / 1000;
    } else if (activeTimer.mode === 'down') {
      activeTimer.remaining = activeTimer.baseRemaining - (now - activeTimer.startTs) / 1000;
      if (activeTimer.remaining <= 0) {
        activeTimer.remaining = 0;
        finishCountdown();
      }
    } else if (activeTimer.mode === 'pomodoro') {
      activeTimer.remaining = activeTimer.baseRemaining - (now - activeTimer.startTs) / 1000;
      if (activeTimer.remaining <= 0) {
        activeTimer.remaining = 0;
        finishPomodoroPhase();
      }
    }
    renderTimerDisplay();
    if (activeTimer && activeTimer.mode === 'up' && activeTimer.running) {
      // 正计时实时累计到今日
      addDailyTime(0); // 仅刷新显示，真正记账在停止时
    }
  }

  function addDailyTime(seconds) {
    var t = todayStr();
    if (!state.timeLog[t]) state.timeLog[t] = 0;
    state.timeLog[t] += seconds;
    save();
  }

  // ---------- 渲染入口 ----------
  var viewRoot = document.getElementById('view-root');
  var headerTitle = document.getElementById('headerTitle');
  var headerSub = document.getElementById('headerSub');
  var currentView = 'countdown';

  var VIEW_META = {
    countdown: { title: '倒计时', sub: '距离目标还有…' },
    checkin: { title: '每日打卡', sub: '坚持就是胜利' },
    timer: { title: '专注计时', sub: '正计时 · 倒计时 · 番茄' },
    settings: { title: '我的', sub: '备考数据一目了然' }
  };

  function switchView(v) {
    currentView = v;
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.view === v);
    });
    var meta = VIEW_META[v];
    headerTitle.textContent = meta.title;
    headerSub.textContent = meta.sub;
    render();
  }

  function render() {
    if (currentView === 'countdown') renderCountdown();
    else if (currentView === 'checkin') renderCheckin();
    else if (currentView === 'timer') renderTimer();
    else if (currentView === 'settings') renderSettings();
  }

  // ========== 倒计时视图 ==========
  function renderCountdown() {
    var t = todayStr();
    var html = '';
    state.targets.forEach(function (tg) {
      var diff = daysBetween(t, tg.date);
      var big, tag, tagCls = '';
      if (diff > 0) { big = diff; tag = '天'; }
      else if (diff === 0) { big = 0; tag = '天'; tagCls = 'tag-urgent'; }
      else { big = Math.abs(diff); tag = '天前'; tagCls = 'tag-passed'; }
      var urgent = diff > 0 && diff <= 30 ? 'tag-urgent' : '';
      html += '<div class="card count-card">'
        + '<div class="count-row">'
        + '<div><div class="name">' + escapeHtml(tg.name) + '</div>'
        + '<div class="date">目标日 ' + tg.date + '</div></div>'
        + '<span class="pill ' + (urgent || tagCls) + '">' + (diff === 0 ? '就是今天' : (diff > 0 ? '进行中' : '已结束')) + '</span>'
        + '</div>'
        + '<div class="big" style="margin-top:10px">' + big + ' <small>' + tag + '</small></div>'
        + '<div style="margin-top:10px">'
        + (tg.fixed
            ? '<button class="btn ghost sm" data-edit-target="' + tg.id + '">修改日期</button>'
            : '<button class="btn ghost sm" data-edit-target="' + tg.id + '">修改</button> <button class="btn danger sm" data-del-target="' + tg.id + '">删除</button>')
        + '</div>'
        + '</div>';
    });
    html += '<button class="btn block light" data-add-target="1">＋ 添加自定义倒计时</button>';
    viewRoot.innerHTML = html;
    bindCountdown();
  }

  function bindCountdown() {
    viewRoot.querySelectorAll('[data-edit-target]').forEach(function (b) {
      b.onclick = function () {
        var tg = state.targets.find(function (x) { return x.id === b.dataset.editTarget; });
        openTargetModal(tg);
      };
    });
    viewRoot.querySelectorAll('[data-del-target]').forEach(function (b) {
      b.onclick = function () {
        if (confirm('确定删除该倒计时「' + (state.targets.find(function (x) { return x.id === b.dataset.delTarget; }) || {}).name + '」？')) {
          state.targets = state.targets.filter(function (x) { return x.id !== b.dataset.delTarget; });
          save(); render();
        }
      };
    });
    var addBtn = viewRoot.querySelector('[data-add-target]');
    if (addBtn) addBtn.onclick = function () { openTargetModal(null); };
  }

  function openTargetModal(tg) {
    var isNew = !tg;
    var name = tg ? tg.name : '';
    var date = tg ? tg.date : '';
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = '<div class="modal">'
      + '<h3>' + (isNew ? '添加倒计时' : '编辑倒计时') + '</h3>'
      + '<p class="modal-sub">填写事件名称与目标日期</p>'
      + '<label>名称</label><input id="mt-name" value="' + escapeAttr(name) + '" placeholder="如：复试 / 生日" />'
      + '<label>目标日期</label><input id="mt-date" type="date" value="' + date + '" />'
      + '<div class="modal-actions"><button class="btn light" id="mt-cancel">取消</button>'
      + '<button class="btn" id="mt-ok">保存</button></div>'
      + '</div>';
    document.body.appendChild(mask);
    mask.querySelector('#mt-cancel').onclick = function () { mask.remove(); };
    mask.querySelector('#mt-ok').onclick = function () {
      var nm = mask.querySelector('#mt-name').value.trim();
      var dt = mask.querySelector('#mt-date').value;
      if (!nm) { toast('请输入名称'); return; }
      if (!dt) { toast('请选择日期'); return; }
      if (isNew) {
        state.targets.push({ id: uid(), name: nm, date: dt, fixed: false });
      } else {
        tg.name = nm; tg.date = dt;
      }
      save(); mask.remove(); render(); toast('已保存');
    };
  }

  // ========== 打卡视图 ==========
  function renderCheckin() {
    var t = todayStr();
    var rec = state.records[t] || {};
    var html = '<div class="card">';
    html += '<div class="card-title"><span>今日打卡</span><span class="streak-badge" id="todayCount">' + Object.keys(rec).length + '/' + state.checkins.length + '</span></div>';
    if (state.checkins.length === 0) {
      html += '<div class="empty">还没有打卡项，点击下方添加你的每日习惯～</div>';
    } else {
      state.checkins.forEach(function (c) {
        var done = !!rec[c.id];
        html += '<div class="checkin-item">'
          + '<div class="ci-main"><div class="ci-name">' + escapeHtml(c.name) + '</div>'
          + '<div class="ci-meta">连续 ' + streakOf(c.id) + ' 天</div></div>'
          + '<div class="ci-check ' + (done ? 'done' : '') + '" data-check="' + c.id + '">' + (done ? '✓' : '') + '</div>'
          + '</div>';
      });
    }
    html += '</div>';
    html += '<button class="btn block ghost" data-add-check="1" style="margin-bottom:14px">＋ 添加打卡项</button>';

    // 近 30 天日历
    html += '<div class="card"><div class="card-title">近 30 天打卡情况</div>';
    html += '<div class="calendar" id="cal"></div></div>';

    viewRoot.innerHTML = html;
    bindCheckin();
    renderCalendar();
  }

  function bindCheckin() {
    viewRoot.querySelectorAll('[data-check]').forEach(function (el) {
      el.onclick = function () {
        var id = el.dataset.check;
        var t = todayStr();
        if (!state.records[t]) state.records[t] = {};
        if (state.records[t][id]) { delete state.records[t][id]; }
        else { state.records[t][id] = true; }
        save(); renderCheckin();
      };
    });
    var add = viewRoot.querySelector('[data-add-check]');
    if (add) add.onclick = openCheckModal;
  }

  function openCheckModal() {
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = '<div class="modal">'
      + '<h3>添加打卡项</h3><p class="modal-sub">例如：背单词 / 刷数学题 / 早起</p>'
      + '<label>名称</label><input id="ck-name" placeholder="打卡内容" />'
      + '<div class="modal-actions"><button class="btn light" id="ck-cancel">取消</button>'
      + '<button class="btn" id="ck-ok">添加</button></div></div>';
    document.body.appendChild(mask);
    mask.querySelector('#ck-cancel').onclick = function () { mask.remove(); };
    mask.querySelector('#ck-ok').onclick = function () {
      var nm = mask.querySelector('#ck-name').value.trim();
      if (!nm) { toast('请输入名称'); return; }
      state.checkins.push({ id: uid(), name: nm, createdAt: Date.now() });
      save(); mask.remove(); renderCheckin();
    };
  }

  function streakOf(id) {
    var streak = 0;
    var d = new Date();
    // 如果今天没打卡，从昨天算起连续
    var t = todayStr(d);
    if (!state.records[t] || !state.records[t][id]) {
      d.setDate(d.getDate() - 1);
    }
    while (true) {
      var ts = todayStr(d);
      if (state.records[ts] && state.records[ts][id]) {
        streak++; d.setDate(d.getDate() - 1);
      } else break;
    }
    return streak;
  }

  function renderCalendar() {
    var cal = document.getElementById('cal');
    if (!cal) return;
    var html = '';
    var today = new Date();
    for (var i = 29; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(today.getDate() - i);
      var ts = todayStr(d);
      var doneCount = state.records[ts] ? Object.keys(state.records[ts]).length : 0;
      var total = state.checkins.length;
      var done = total > 0 && doneCount === total;
      var isToday = ts === todayStr();
      var label = d.getDate();
      html += '<div class="cal-cell ' + (done ? 'done' : '') + (isToday ? ' today' : '') + '" title="' + ts + ' ' + doneCount + '/' + total + '">' + label + '</div>';
    }
    cal.innerHTML = html;
  }

  // ========== 计时视图 ==========
  var timerMode = 'up';
  var countdownPreset = 25 * 60;
  var pomodoroPhase = 'work'; // work | short | long
  var pomodoroCount = 0;

  function renderTimer() {
    var html = '';
    // 今日累计
    var t = todayStr();
    var totalSec = state.timeLog[t] || 0;
    html += '<div class="card daily-total">'
      + '<div class="card-title" style="justify-content:center">今日累计学习时长</div>'
      + '<div class="num">' + fmtHM(totalSec) + '</div>'
      + '<div class="lbl">(' + fmtDuration(totalSec) + ')</div>'
      + '</div>';

    // 模式切换
    html += '<div class="timer-mode-tabs">'
      + '<button data-mode="up" class="' + (timerMode === 'up' ? 'active' : '') + '">正计时</button>'
      + '<button data-mode="down" class="' + (timerMode === 'down' ? 'active' : '') + '">倒计时</button>'
      + '<button data-mode="pomodoro" class="' + (timerMode === 'pomodoro' ? 'active' : '') + '">番茄钟</button>'
      + '</div>';

    html += '<div class="card">';
    if (timerMode === 'up') {
      html += '<div class="timer-label">正计时 — 记录你专注的每一秒</div>';
      html += '<div class="timer-display" id="disp">00:00</div>';
      html += '<div class="timer-controls">'
        + '<button class="btn" id="t-toggle">开始</button>'
        + '<button class="btn light" id="t-reset">重置</button></div>';
    } else if (timerMode === 'down') {
      html += '<div class="timer-label">倒计时 — 设定时长，到点提醒</div>';
      html += '<div class="timer-display" id="disp">25:00</div>';
      html += '<div class="sub-opts" id="down-presets">'
        + presetChip(5 * 60, '5分钟') + presetChip(15 * 60, '15分钟')
        + presetChip(25 * 60, '25分钟') + presetChip(45 * 60, '45分钟')
        + presetChip(60 * 60, '60分钟') + '</div>';
      html += '<div class="timer-controls">'
        + '<button class="btn" id="t-toggle">开始</button>'
        + '<button class="btn light" id="t-reset">重置</button></div>';
    } else {
      html += '<div class="timer-label" id="pomo-label">番茄钟 — 工作 25 分钟</div>';
      html += '<div class="timer-display" id="disp">25:00</div>';
      html += '<div class="sub-opts" id="pomo-presets" style="justify-content:center">'
        + '<span class="chip">已完成 ' + pomodoroCount + ' 个番茄</span></div>';
      html += '<div class="timer-controls">'
        + '<button class="btn" id="t-toggle">开始</button>'
        + '<button class="btn light" id="t-reset">重置</button></div>';
    }
    html += '</div>';
    viewRoot.innerHTML = html;
    bindTimer();
    renderTimerDisplay();
  }

  function presetChip(sec, label) {
    return '<span class="chip ' + (countdownPreset === sec ? 'active' : '') + '" data-preset="' + sec + '">' + label + '</span>';
  }

  function bindTimer() {
    viewRoot.querySelectorAll('[data-mode]').forEach(function (b) {
      b.onclick = function () {
        timerMode = b.dataset.mode;
        resetTimerState();
        render();
      };
    });
    var disp = document.getElementById('disp');
    if (timerMode === 'down') {
      viewRoot.querySelectorAll('[data-preset]').forEach(function (c) {
        c.onclick = function () {
          countdownPreset = parseInt(c.dataset.preset, 10);
          if (!activeTimer || !activeTimer.running) renderTimerDisplay();
          render();
        };
      });
    }
    var toggle = document.getElementById('t-toggle');
    if (toggle) toggle.onclick = onToggle;
    var reset = document.getElementById('t-reset');
    if (reset) reset.onclick = function () { resetTimerState(); render(); toast('已重置'); };
  }

  function resetTimerState() {
    // 把正计时已记录时长入账
    if (activeTimer && activeTimer.mode === 'up' && activeTimer.elapsed > 0) {
      // 已在停止时入账
    }
    activeTimer = null;
    pomodoroPhase = 'work';
    pomodoroCount = (timerMode === 'pomodoro') ? pomodoroCount : 0;
  }

  function ensureTimer() {
    if (activeTimer) return;
    if (timerMode === 'up') {
      activeTimer = { mode: 'up', running: false, startTs: 0, baseElapsed: 0, elapsed: 0 };
    } else if (timerMode === 'down') {
      activeTimer = { mode: 'down', running: false, startTs: 0, baseRemaining: countdownPreset, remaining: countdownPreset };
    } else {
      var dur = (pomodoroPhase === 'work') ? state.pomodoro.work : (pomodoroPhase === 'long' ? state.pomodoro.long : state.pomodoro.short);
      dur = dur * 60;
      activeTimer = { mode: 'pomodoro', running: false, startTs: 0, baseRemaining: dur, remaining: dur, phase: pomodoroPhase };
    }
  }

  function onToggle() {
    ensureTimer();
    if (activeTimer.running) {
      // 暂停
      pauseActive();
      render();
    } else {
      activeTimer.running = true;
      activeTimer.startTs = Date.now();
      if (activeTimer.mode === 'up') activeTimer.baseElapsed = activeTimer.elapsed || 0;
      if (activeTimer.mode === 'down') activeTimer.baseRemaining = activeTimer.remaining || 0;
      if (activeTimer.mode === 'pomodoro') activeTimer.baseRemaining = activeTimer.remaining || 0;
      render();
    }
  }

  function pauseActive() {
    var now = Date.now();
    if (activeTimer.mode === 'up') {
      var inc = (now - activeTimer.startTs) / 1000;
      activeTimer.elapsed = (activeTimer.elapsed || 0) + inc;
      addDailyTime(inc);
    } else if (activeTimer.mode === 'down') {
      activeTimer.remaining = (activeTimer.remaining || 0) - (now - activeTimer.startTs) / 1000;
    } else if (activeTimer.mode === 'pomodoro') {
      activeTimer.remaining = (activeTimer.remaining || 0) - (now - activeTimer.startTs) / 1000;
    }
    activeTimer.running = false;
  }

  function finishCountdown() {
    activeTimer.running = false;
    notify('倒计时结束', '设定时间已到，休息一下吧！');
    render();
  }

  function finishPomodoroPhase() {
    activeTimer.running = false;
    if (activeTimer.phase === 'work') {
      pomodoroCount++;
      addDailyTime(state.pomodoro.work * 60);
      // 每 longEvery 个进入长休息
      if (pomodoroCount % state.pomodoro.longEvery === 0) pomodoroPhase = 'long';
      else pomodoroPhase = 'short';
      notify('番茄完成', '干得漂亮！该休息 ' + (pomodoroPhase === 'long' ? state.pomodoro.long : state.pomodoro.short) + ' 分钟');
    } else {
      pomodoroPhase = 'work';
      notify('休息结束', '开始新的番茄钟吧！');
    }
    render();
  }

  function renderTimerDisplay() {
    var disp = document.getElementById('disp');
    if (!disp) return;
    if (!activeTimer) {
      if (timerMode === 'up') disp.textContent = '00:00';
      else if (timerMode === 'down') disp.textContent = fmtDuration(countdownPreset);
      else {
        var dur = (pomodoroPhase === 'work') ? state.pomodoro.work : (pomodoroPhase === 'long' ? state.pomodoro.long : state.pomodoro.short);
        disp.textContent = fmtDuration(dur * 60);
      }
      var tg = document.getElementById('t-toggle'); if (tg) tg.textContent = '开始';
      return;
    }
    if (activeTimer.mode === 'up') {
      disp.textContent = fmtDuration(activeTimer.elapsed || 0);
    } else {
      disp.textContent = fmtDuration(activeTimer.remaining || 0);
    }
    var tg = document.getElementById('t-toggle');
    if (tg) tg.textContent = activeTimer.running ? '暂停' : '继续';

    var pl = document.getElementById('pomo-label');
    if (pl && activeTimer.mode === 'pomodoro') {
      pl.textContent = '番茄钟 — ' + (activeTimer.phase === 'work' ? '工作 ' + state.pomodoro.work + ' 分钟' : (activeTimer.phase === 'long' ? '长休息 ' + state.pomodoro.long + ' 分钟' : '短休息 ' + state.pomodoro.short + ' 分钟'));
    }
  }

  // ========== 设置视图 ==========
  function renderSettings() {
    var totalDays = 0;
    var totalSec = 0;
    Object.keys(state.timeLog).forEach(function (k) { totalSec += state.timeLog[k]; });
    Object.keys(state.records).forEach(function (k) {
      if (state.records[k] && Object.keys(state.records[k]).length > 0) totalDays++;
    });
    var html = '';
    html += '<div class="card"><div class="card-title">备考数据</div>'
      + '<div class="stat-grid">'
      + '<div class="stat-box"><div class="v">' + state.targets.length + '</div><div class="k">倒计时事件</div></div>'
      + '<div class="stat-box"><div class="v">' + state.checkins.length + '</div><div class="k">打卡习惯</div></div>'
      + '<div class="stat-box"><div class="v">' + totalDays + '</div><div class="k">累计打卡天</div></div>'
      + '<div class="stat-box"><div class="v">' + fmtHM(totalSec) + '</div><div class="k">累计专注时长</div></div>'
      + '</div></div>';

    // 番茄设置
    html += '<div class="card"><div class="card-title">番茄钟设置（分钟）</div>';
    html += '<div class="field-row"><div><label>工作</label><input id="p-work" type="number" value="' + state.pomodoro.work + '" /></div>'
      + '<div><label>短休息</label><input id="p-short" type="number" value="' + state.pomodoro.short + '" /></div></div>';
    html += '<div class="field-row" style="margin-top:10px"><div><label>长休息</label><input id="p-long" type="number" value="' + state.pomodoro.long + '" /></div>'
      + '<div><label>长休息间隔</label><input id="p-every" type="number" value="' + state.pomodoro.longEvery + '" /></div></div>';
    html += '<button class="btn block" id="save-pomo" style="margin-top:14px">保存番茄设置</button></div>';

    html += '<div class="card"><div class="card-title">数据管理</div>'
      + '<button class="btn block light" id="export-data">导出数据（JSON）</button>'
      + '<button class="btn block danger" id="reset-data" style="margin-top:10px">清空全部数据</button></div>';

    html += '<div class="card" style="text-align:center;color:var(--muted);font-size:12px;line-height:1.7">'
      + '备考助手 · 纯本地运行的 PWA<br/>'
      + '在 Safari 中打开 → 分享 →「添加到主屏幕」<br/>即可像 App 一样使用，支持离线'
      + '</div>';

    viewRoot.innerHTML = html;
    bindSettings();
  }

  function bindSettings() {
    var sp = document.getElementById('save-pomo');
    if (sp) sp.onclick = function () {
      var w = parseInt(document.getElementById('p-work').value, 10);
      var s = parseInt(document.getElementById('p-short').value, 10);
      var l = parseInt(document.getElementById('p-long').value, 10);
      var e = parseInt(document.getElementById('p-every').value, 10);
      if (w > 0 && s > 0 && l > 0 && e > 0) {
        state.pomodoro = { work: w, short: s, long: l, longEvery: e };
        save(); toast('番茄设置已保存');
      } else toast('请填写正确数值');
    };
    var ex = document.getElementById('export-data');
    if (ex) ex.onclick = function () {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'kaoyan-backup-' + todayStr() + '.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    };
    var rs = document.getElementById('reset-data');
    if (rs) rs.onclick = function () {
      if (confirm('确定清空所有数据？此操作不可恢复！')) {
        state = JSON.parse(JSON.stringify(DEFAULTS));
        save(); render(); toast('已清空');
      }
    };
  }

  // ---------- 通知 ----------
  function notify(title, body) {
    toast(title + '：' + body);
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: body });
      }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch (e) {}
  }

  // ---------- 工具 ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2000);
  }

  // ---------- 启动 ----------
  document.querySelectorAll('.tab').forEach(function (t) {
    t.onclick = function () { switchView(t.dataset.view); };
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
  switchView('countdown');
})();

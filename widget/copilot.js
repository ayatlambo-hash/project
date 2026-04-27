/**
 * Установка: <script src="copilot.js" data-backend="https://your-app.railway.app"></script>
 *  ✅ HTTPS: авто-апгрейд backend URL, понятные ошибки при mixed content
 *  ✅ Навигация без потери чата: SPA-режим для того же домена, iframe для внешних
 *  ✅ Голосовой ввод: Web Speech API с индикатором записи
 *  ✅ Управление жестами: MediaPipe Hands (загружается лениво при включении камеры)
 *     ✊ Кулак → открыть/закрыть чат
 *     ☝️ Указательный → голосовой ввод
 *     👍 Большой палец → отправить сообщение
 *     ✋ Открытая ладонь → стоп/отмена
 *     ✌️ Два пальца → прокрутить вниз
 */
(function () {
  'use strict';

  /* CONFIG*/
  let BACKEND = (
    document.currentScript?.getAttribute('data-backend') ||
    window.COPILOT_API_URL ||
    'http://localhost:8000'
  ).replace(/\/$/, '');

  // HTTPS Fix: авто-апгрейд если страница на HTTPS, а backend нет
  const isPageHttps = location.protocol === 'https:';
  const isBackendHttp = BACKEND.startsWith('http:');
  const isLocalBackend = /localhost|127\.0\.0\.1/.test(BACKEND);

  if (isPageHttps && isBackendHttp && !isLocalBackend) {
    BACKEND = BACKEND.replace('http:', 'https:');
    console.info('[AI Copilot v4] ✅ Backend URL авто-апгрейдован до HTTPS:', BACKEND);
  }

  const MIXED_CONTENT = isPageHttps && BACKEND.startsWith('http:');
  const STORAGE_KEY   = 'aico-v4-' + location.hostname;

  /* UTILITY*/
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.crossOrigin = 'anonymous';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /*STYLES */
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    /* Toggle Button  */
    #aico-btn {
      position: fixed; bottom: 28px; right: 28px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none; cursor: pointer;
      box-shadow: 0 8px 24px rgba(102,126,234,0.5);
      display: flex; align-items: center; justify-content: center;
      transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    #aico-btn:hover { transform: scale(1.1) rotate(5deg); box-shadow: 0 12px 32px rgba(102,126,234,0.65); }
    #aico-btn.open { border-radius: 50%; }
    #aico-btn svg { width: 26px; height: 26px; fill: white; transition: all 0.3s; }

    /*Main Panel*/
    #aico-panel {
      position: fixed; bottom: 96px; right: 28px; z-index: 99999;
      width: 390px;
      background: #ffffff; border-radius: 20px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06);
      display: flex; flex-direction: column;
      font-family: 'Inter', -apple-system, sans-serif;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.34,1.56,0.64,1);
      transform-origin: bottom right;
    }
    #aico-panel.hidden { opacity: 0; pointer-events: none; transform: scale(0.8) translateY(20px); }

    /* Navigation Loading Bar*/
    #aico-nav-bar {
      height: 3px;
      background: linear-gradient(90deg, #667eea, #764ba2, #10b981, #667eea);
      background-size: 300% 100%;
      animation: aico-shimmer 1.8s linear infinite;
      display: none; flex-shrink: 0;
    }
    #aico-nav-bar.visible { display: block; }
    @keyframes aico-shimmer { 0%{background-position:300% 0} 100%{background-position:-300% 0} }

    /* Header*/
    #aico-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 14px 16px;
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    #aico-avatar {
      width: 34px; height: 34px; border-radius: 10px;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; flex-shrink: 0;
    }
    #aico-header-info { flex: 1; min-width: 0; }
    #aico-header-title { color: white; font-weight: 600; font-size: 14px; }
    #aico-header-sub {
      color: rgba(255,255,255,0.7); font-size: 10px; margin-top: 1px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #aico-header-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .aico-icon-btn {
      background: rgba(255,255,255,0.15); border: none; color: white;
      cursor: pointer; width: 28px; height: 28px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; transition: background 0.2s; user-select: none;
    }
    .aico-icon-btn:hover { background: rgba(255,255,255,0.28); }
    .aico-icon-btn.active { background: rgba(255,255,255,0.35); box-shadow: 0 0 0 2px rgba(255,255,255,0.5); }

    /*HTTPS Warning*/
    #aico-https-warn {
      margin: 8px 12px 0; padding: 8px 12px;
      background: #fff8e6; border: 1px solid #f59e0b; border-radius: 10px;
      font-size: 11px; color: #92400e; line-height: 1.5; display: none;
    }
    #aico-https-warn.visible { display: block; }
    #aico-https-warn a { color: #92400e; font-weight: 600; }

    /* Intent Bar  */
    #aico-intent-bar {
      padding: 7px 14px; background: #f8f8ff; border-bottom: 1px solid #f0f0f8;
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; color: #888; min-height: 31px; flex-shrink: 0;
    }
    #aico-intent-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #ccc; transition: all 0.4s; flex-shrink: 0;
    }
    #aico-intent-dot.browsing     { background: #94a3b8; }
    #aico-intent-dot.interested   { background: #f59e0b; box-shadow: 0 0 6px rgba(245,158,11,0.5); }
    #aico-intent-dot.ready_to_buy { background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.6); animation: aico-pulse 1.4s infinite; }
    @keyframes aico-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.35)} }

    /*  Action Banner  */
    #aico-action-banner {
      margin: 8px 12px;
      background: linear-gradient(135deg, #10b981, #059669);
      border-radius: 10px; padding: 9px 13px;
      color: white; font-size: 12px; font-weight: 500;
      display: none; align-items: center; gap: 10px; flex-shrink: 0;
    }
    #aico-action-banner.visible { display: flex; }
    #aico-action-banner svg { width: 15px; height: 15px; fill: white; flex-shrink: 0; }
    #aico-action-undo {
      background: rgba(255,255,255,0.2); border: none; color: white;
      font-size: 11px; padding: 3px 8px; border-radius: 6px; cursor: pointer;
    }

    /*  Nav Countdown Banner */
    #aico-nav-banner {
      margin: 8px 12px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-radius: 10px; padding: 9px 13px;
      color: white; font-size: 12px;
      display: none; align-items: center; gap: 10px; flex-shrink: 0;
    }
    #aico-nav-banner.visible { display: flex; }
    #aico-nav-countdown { font-weight: 700; font-size: 18px; min-width: 22px; text-align: center; }
    #aico-nav-desc { flex: 1; font-weight: 500; }
    #aico-nav-cancel {
      background: rgba(255,255,255,0.2); border: none; color: white;
      font-size: 11px; padding: 3px 8px; border-radius: 6px; cursor: pointer;
    }

    /*  Messages  */
    #aico-messages {
      height: 280px; overflow-y: auto; padding: 12px 12px 6px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
    }
    #aico-messages::-webkit-scrollbar { width: 4px; }
    #aico-messages::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 2px; }

    .aico-msg {
      max-width: 88%; padding: 10px 14px; border-radius: 16px;
      font-size: 13px; line-height: 1.55; word-break: break-word;
      animation: aico-fadeup 0.3s ease;
    }
    @keyframes aico-fadeup { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    .aico-msg.bot     { background:#f4f4f8; color:#1a1a2e; align-self:flex-start; border-bottom-left-radius:4px; }
    .aico-msg.user    { background:linear-gradient(135deg,#667eea,#764ba2); color:white; align-self:flex-end; border-bottom-right-radius:4px; }
    .aico-msg.error   { background:#fff5f5; color:#c0392b; align-self:flex-start; border:1px solid #fde8e8; font-size:12px; max-width:96%; }
    .aico-msg.thinking{ background:#f4f4f8; color:#999; align-self:flex-start; font-size:12px; }

    .aico-typing-cursor {
      display: inline-block; width: 2px; height: 13px; background: #667eea;
      margin-left: 2px; animation: aico-blink 0.7s infinite; vertical-align: middle;
    }
    @keyframes aico-blink { 0%,100%{opacity:1} 50%{opacity:0} }

    /*  Link Chips  */
    .aico-link-suggestions { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
    .aico-link-chip {
      background: #eef0ff; border: 1px solid rgba(102,126,234,0.3);
      border-radius: 8px; padding: 4px 10px; font-size: 11px;
      cursor: pointer; color: #667eea; font-family: inherit;
      transition: all 0.2s; font-weight: 500;
    }
    .aico-link-chip:hover { background: #667eea; color: white; }
    .aico-link-chip::before { content: "→ "; }

    /* Voice Transcript  */
    #aico-transcript {
      padding: 5px 14px; background: #fef3c7; border-top: 1px solid #fde68a;
      font-size: 11px; color: #92400e;
      display: none; align-items: center; gap: 8px; min-height: 28px;
      flex-shrink: 0;
    }
    #aico-transcript.visible { display: flex; }
    #aico-transcript-dot {
      width: 7px; height: 7px; border-radius: 50%; background: #ef4444;
      animation: aico-pulse 0.9s infinite; flex-shrink: 0;
    }
    #aico-transcript-text { flex: 1; font-style: italic; }

    /* Suggestions */
    #aico-suggestions { padding: 6px 10px 4px; display: flex; flex-wrap: wrap; gap: 5px; flex-shrink: 0; }
    .aico-chip {
      background: #f0f0f9; border: 1px solid rgba(102,126,234,0.2);
      border-radius: 20px; padding: 5px 12px; font-size: 11px;
      cursor: pointer; color: #667eea; font-family: inherit;
      transition: all 0.2s; font-weight: 500;
    }
    .aico-chip:hover { background: #667eea; color: white; transform: translateY(-1px); }

    /* Footer */
    #aico-footer {
      padding: 8px 10px 10px; border-top: 1px solid #f0f0f0;
      display: flex; gap: 6px; align-items: center; flex-shrink: 0;
    }
    #aico-input {
      flex: 1; border: 1.5px solid #e8e8f0; border-radius: 12px;
      padding: 8px 12px; font-size: 13px; outline: none;
      font-family: inherit; background: #fafafa; transition: all 0.2s;
    }
    #aico-input:focus { border-color: #667eea; background: white; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
    #aico-input:disabled { background: #f5f5f5; color: #aaa; }

    #aico-mic {
      background: #f4f4f8; border: 1.5px solid #e8e8f0; border-radius: 12px;
      width: 38px; height: 38px; cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.25s; color: #667eea; padding: 0;
    }
    #aico-mic:hover { border-color: #667eea; background: #eef0ff; }
    #aico-mic.active {
      background: #fee2e2; border-color: #ef4444; color: #ef4444;
      animation: aico-mic-pulse 1.1s ease infinite;
    }
    @keyframes aico-mic-pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
      50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
    }
    #aico-mic svg { width: 16px; height: 16px; fill: currentColor; }

    #aico-send {
      background: linear-gradient(135deg, #667eea, #764ba2);
      border: none; border-radius: 12px; width: 38px; height: 38px;
      cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; box-shadow: 0 4px 12px rgba(102,126,234,0.4);
    }
    #aico-send:hover { transform: scale(1.06); }
    #aico-send:disabled { background: #ddd; cursor: not-allowed; box-shadow: none; transform: none; }
    #aico-send svg { width: 15px; height: 15px; fill: white; }

    #aico-powered { text-align: center; padding: 5px 0 8px; font-size: 10px; color: #ccc; flex-shrink: 0; }
    #aico-powered span { color: #667eea; font-weight: 600; }

    /*IFRAME BROWSER OVERLAY*/
    #aico-browser {
      position: fixed; inset: 0; z-index: 99990;
      display: flex; flex-direction: column;
      background: #1a1a2e; animation: aico-slidein 0.3s ease;
    }
    #aico-browser.hidden { display: none; }
    @keyframes aico-slidein { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    #aico-browser-bar {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; background: #16213e;
      border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
    }
    #aico-browser-back {
      background: rgba(255,255,255,0.1); border: none; color: white;
      width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
      font-size: 16px; display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    #aico-browser-back:hover { background: rgba(255,255,255,0.2); }
    #aico-browser-url {
      flex: 1; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; padding: 5px 12px; color: rgba(255,255,255,0.7);
      font-size: 11px; font-family: monospace;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #aico-browser-close {
      background: #e74c3c; border: none; color: white; padding: 5px 12px;
      border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600;
      font-family: inherit; transition: background 0.2s;
    }
    #aico-browser-close:hover { background: #c0392b; }
    #aico-browser-frame { flex: 1; border: none; width: 100%; background: white; }
    #aico-browser-blocked {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: white; gap: 14px; padding: 40px; text-align: center;
    }
    #aico-browser-blocked .bb-icon { font-size: 52px; }
    #aico-browser-blocked h3 { font-size: 17px; margin: 0; font-family: 'Inter', sans-serif; }
    #aico-browser-blocked p { color: rgba(255,255,255,0.55); font-size: 13px; margin: 0; font-family: 'Inter', sans-serif; line-height: 1.6; }
    #aico-browser-open {
      background: linear-gradient(135deg, #667eea, #764ba2);
      border: none; color: white; padding: 12px 24px;
      border-radius: 12px; cursor: pointer; font-size: 14px;
      font-weight: 600; font-family: inherit; transition: opacity 0.2s;
    }
    #aico-browser-open:hover { opacity: 0.85; }

    /* ═══COMPUTER VISION PANEL*/
    #aico-cv-panel {
      position: fixed; bottom: 96px; left: 28px; z-index: 99997;
      width: 260px; background: #0d0d1a; border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07);
      display: none; font-family: 'Inter', -apple-system, sans-serif;
    }
    #aico-cv-panel.visible {
      display: block;
      animation: aico-slidein 0.3s ease;
    }
    #aico-cv-header {
      background: linear-gradient(135deg, #667eea, #764ba2);
      padding: 10px 12px;
      display: flex; align-items: center; justify-content: space-between;
    }
    #aico-cv-header-title { color: white; font-size: 12px; font-weight: 600; }
    #aico-cv-close-btn {
      background: rgba(255,255,255,0.2); border: none; color: white;
      width: 22px; height: 22px; border-radius: 6px; cursor: pointer;
      font-size: 11px; display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    #aico-cv-close-btn:hover { background: rgba(255,255,255,0.35); }

    /* Video + Canvas */
    #aico-cv-video-wrap { position: relative; height: 160px; background: #000; overflow: hidden; }
    #aico-cv-video {
      width: 100%; height: 100%; object-fit: cover;
      transform: scaleX(-1); display: block;
    }
    #aico-cv-canvas {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
    }
    #aico-cv-loading {
      position: absolute; inset: 0; background: rgba(13,13,26,0.85);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; color: white; font-size: 12px; font-family: 'Inter', sans-serif;
    }
    #aico-cv-loading.hidden { display: none; }
    .aico-cv-spinner {
      width: 28px; height: 28px; border: 3px solid rgba(102,126,234,0.3);
      border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Gesture Status */
    #aico-cv-status {
      padding: 10px 12px; background: #16213e;
      display: flex; align-items: center; gap: 10px;
    }
    #aico-cv-gesture-icon { font-size: 28px; width: 38px; text-align: center; line-height: 1; }
    #aico-cv-gesture-name { color: white; font-size: 13px; font-weight: 600; }
    #aico-cv-gesture-desc { color: rgba(255,255,255,0.45); font-size: 10px; margin-top: 2px; }

    /* Gesture Guide */
    #aico-cv-guide { padding: 8px 12px 11px; border-top: 1px solid rgba(255,255,255,0.06); background: #16213e; }
    #aico-cv-guide-title {
      color: rgba(255,255,255,0.3); font-size: 9px; font-weight: 600;
      letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 7px;
    }
    .aico-cv-cmd { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
    .aico-cv-cmd-icon { font-size: 14px; width: 20px; text-align: center; }
    .aico-cv-cmd-text { color: rgba(255,255,255,0.5); font-size: 10px; }

    /* ── Gesture Toast ─────────────────────────────────────────────────────── */
    #aico-gesture-toast {
      position: fixed; bottom: 104px; left: 50%;
      transform: translateX(-50%) scale(0.88);
      background: rgba(10,10,26,0.9); color: white;
      padding: 9px 20px; border-radius: 28px;
      font-size: 13px; font-family: 'Inter', sans-serif;
      z-index: 999999; pointer-events: none;
      opacity: 0; transition: opacity 0.25s, transform 0.25s;
      white-space: nowrap; border: 1px solid rgba(102,126,234,0.3);
    }
    #aico-gesture-toast.visible {
      opacity: 1; transform: translateX(-50%) scale(1);
    }
  `;
  document.head.appendChild(style);

  /*ICONS (SVG inline)*/
  const iconChat  = () => `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
  const iconClose = () => `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  const iconSend  = () => `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
  const iconMic   = () => `<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;

  /*DOM — create elements*/
  //Toggle button
  const btn = document.createElement('button');
  btn.id = 'aico-btn'; btn.title = 'AI Copilot';
  btn.innerHTML = iconChat();

  //Chat panel
  const panel = document.createElement('div');
  panel.id = 'aico-panel'; panel.classList.add('hidden');
  panel.innerHTML = `
    <div id="aico-nav-bar"></div>
    <div id="aico-header">
      <div id="aico-avatar">🤖</div>
      <div id="aico-header-info">
        <div id="aico-header-title">AI Copilot</div>
        <div id="aico-header-sub" id="aico-header-sub">Спрашивайте про эту страницу</div>
      </div>
      <div id="aico-header-actions">
        <button class="aico-icon-btn" id="aico-cv-toggle" title="Управление жестами (камера)">👋</button>
        <button class="aico-icon-btn" id="aico-clear" title="Очистить историю">🗑</button>
        <button class="aico-icon-btn" id="aico-close" title="Закрыть">✕</button>
      </div>
    </div>
    <div id="aico-https-warn">
      ⚠️ <strong>Mixed Content:</strong> Сайт на HTTPS, но backend на HTTP — браузер заблокирует запросы.<br>
      Разверните backend на <a href="https://railway.app" target="_blank">Railway</a> или используйте <a href="https://ngrok.com" target="_blank">ngrok</a> для HTTPS.
    </div>
    <div id="aico-intent-bar">
      <div id="aico-intent-dot" class="browsing"></div>
      <div id="aico-intent-text">
        <span id="aico-intent-label">Просматривает</span> — пользователь изучает страницу
      </div>
    </div>
    <div id="aico-action-banner">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      <div id="aico-action-desc">Действие выполнено</div>
      <button id="aico-action-undo">Отменить</button>
    </div>
    <div id="aico-nav-banner">
      <div id="aico-nav-countdown">3</div>
      <div id="aico-nav-desc">Перехожу...</div>
      <button id="aico-nav-cancel">Отмена</button>
    </div>
    <div id="aico-messages"></div>
    <div id="aico-transcript">
      <div id="aico-transcript-dot"></div>
      <div id="aico-transcript-text">Слушаю...</div>
    </div>
    <div id="aico-suggestions"></div>
    <div id="aico-footer">
      <input id="aico-input" type="text" placeholder="Задайте вопрос или скажите голосом...">
      <button id="aico-mic" title="Голосовой ввод">${iconMic()}</button>
      <button id="aico-send">${iconSend()}</button>
    </div>
    <div id="aico-powered">Powered by <span>AI Copilot v4</span> · 🎤 Voice · 👋 Vision</div>
  `;

  const browser = document.createElement('div');
  browser.id = 'aico-browser'; browser.classList.add('hidden');
  browser.innerHTML = `
    <div id="aico-browser-bar">
      <button id="aico-browser-back" title="Закрыть">←</button>
      <div id="aico-browser-url">...</div>
      <button id="aico-browser-close">✕ Закрыть</button>
    </div>
    <iframe id="aico-browser-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    <div id="aico-browser-blocked" style="display:none">
      <div class="bb-icon">🔒</div>
      <h3>Страница не открывается внутри виджета</h3>
      <p>Этот сайт запрещает встроенный просмотр через X-Frame-Options.<br>Страница открыта в новой вкладке.</p>
      <button id="aico-browser-open">Открыть снова в новой вкладке</button>
    </div>
  `;

  // Computer Vision panel
  const cvPanel = document.createElement('div');
  cvPanel.id = 'aico-cv-panel';
  cvPanel.innerHTML = `
    <div id="aico-cv-header">
      <span id="aico-cv-header-title">👋 Управление жестами</span>
      <button id="aico-cv-close-btn" title="Закрыть">✕</button>
    </div>
    <div id="aico-cv-video-wrap">
      <video id="aico-cv-video" autoplay playsinline muted></video>
      <canvas id="aico-cv-canvas"></canvas>
      <div id="aico-cv-loading">
        <div class="aico-cv-spinner"></div>
        <span>Загружаю модель жестов...</span>
      </div>
    </div>
    <div id="aico-cv-status">
      <div id="aico-cv-gesture-icon">🤚</div>
      <div>
        <div id="aico-cv-gesture-name">Покажите руку</div>
        <div id="aico-cv-gesture-desc">Жест не распознан</div>
      </div>
    </div>
    <div id="aico-cv-guide">
      <div id="aico-cv-guide-title">Доступные жесты</div>
      <div class="aico-cv-cmd"><span class="aico-cv-cmd-icon">✊</span><span class="aico-cv-cmd-text">Кулак → Открыть / закрыть чат</span></div>
      <div class="aico-cv-cmd"><span class="aico-cv-cmd-icon">☝️</span><span class="aico-cv-cmd-text">Указательный → Голосовой ввод</span></div>
      <div class="aico-cv-cmd"><span class="aico-cv-cmd-icon">👍</span><span class="aico-cv-cmd-text">Большой палец → Отправить сообщение</span></div>
      <div class="aico-cv-cmd"><span class="aico-cv-cmd-icon">✌️</span><span class="aico-cv-cmd-text">Два пальца → Прокрутить вниз</span></div>
      <div class="aico-cv-cmd"><span class="aico-cv-cmd-icon">✋</span><span class="aico-cv-cmd-text">Открытая ладонь → Стоп / отмена</span></div>
    </div>
  `;

  const gestureToast = document.createElement('div');
  gestureToast.id = 'aico-gesture-toast';

  document.body.appendChild(btn);
  document.body.appendChild(panel);
  document.body.appendChild(browser);
  document.body.appendChild(cvPanel);
  document.body.appendChild(gestureToast);

  /* ELEMENT REFERENCES*/
  const messagesEl    = panel.querySelector('#aico-messages');
  const inputEl       = panel.querySelector('#aico-input');
  const sendBtn       = panel.querySelector('#aico-send');
  const micBtn        = panel.querySelector('#aico-mic');
  const suggestEl     = panel.querySelector('#aico-suggestions');
  const intentDot     = panel.querySelector('#aico-intent-dot');
  const intentText    = panel.querySelector('#aico-intent-text');
  const actionBanner  = panel.querySelector('#aico-action-banner');
  const actionDesc    = panel.querySelector('#aico-action-desc');
  const actionUndo    = panel.querySelector('#aico-action-undo');
  const navBanner     = panel.querySelector('#aico-nav-banner');
  const navCountdown  = panel.querySelector('#aico-nav-countdown');
  const navDesc       = panel.querySelector('#aico-nav-desc');
  const navCancel     = panel.querySelector('#aico-nav-cancel');
  const navBar        = panel.querySelector('#aico-nav-bar');
  const transcriptEl  = panel.querySelector('#aico-transcript');
  const transcriptTxt = panel.querySelector('#aico-transcript-text');
  const httpsWarn     = panel.querySelector('#aico-https-warn');
  const cvToggleBtn   = panel.querySelector('#aico-cv-toggle');
  const headerSub     = panel.querySelector('#aico-header-sub');

  const browserFrame   = browser.querySelector('#aico-browser-frame');
  const browserUrlEl   = browser.querySelector('#aico-browser-url');
  const browserClose   = browser.querySelector('#aico-browser-close');
  const browserBack    = browser.querySelector('#aico-browser-back');
  const browserBlocked = browser.querySelector('#aico-browser-blocked');
  const browserOpen    = browser.querySelector('#aico-browser-open');

  const cvVideo        = cvPanel.querySelector('#aico-cv-video');
  const cvCanvas       = cvPanel.querySelector('#aico-cv-canvas');
  const cvLoading      = cvPanel.querySelector('#aico-cv-loading');
  const cvGestureIcon  = cvPanel.querySelector('#aico-cv-gesture-icon');
  const cvGestureName  = cvPanel.querySelector('#aico-cv-gesture-name');
  const cvGestureDesc  = cvPanel.querySelector('#aico-cv-gesture-desc');
  const cvCloseBtn     = cvPanel.querySelector('#aico-cv-close-btn');

  /* STATE*/
  let history       = [];
  let isOpen        = false;
  let isBusy        = false;
  let navTimer      = null;
  let navCancelled  = false;
  let currentNavUrl = '';

  // Voice
  let recognition   = null;
  let isListening   = false;
  const voiceOK     = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // CV
  let cvActive      = false;
  let cameraStream  = null;
  let handsModel    = null;
  let cvFrameId     = null;
  let lastGesture   = null;
  let gestureCool   = false;
  let gestureTimer  = null;

  // Load history
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) history = JSON.parse(s).slice(-20);
  } catch (e) {}
  if (MIXED_CONTENT) httpsWarn.classList.add('visible');

  /*PAGE CONTEXT — reads current DOM (works after SPA navigation)*/
  function getPageContext() {
    const buttons = [];
    document.querySelectorAll('button,[role="button"],.add-btn,.btn').forEach((el, i) => {
      if (el.closest('#aico-panel,#aico-browser,#aico-cv-panel,#aico-btn,#aico-gesture-toast')) return;
      const label = el.textContent.trim().slice(0, 60);
      if (!label) return;
      const cls = el.className?.toString().trim().split(/\s+/)[0] || '';
      const selector = el.id ? `#${el.id}` : cls ? `.${cls}` : `button:nth-child(${i + 1})`;
      buttons.push({ label, selector });
    });

    const links = [];
    document.querySelectorAll('a[href]').forEach(el => {
      if (el.closest('#aico-panel,#aico-browser,#aico-cv-panel')) return;
      const label = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80);
      const href = el.href;
      if (label && href && !href.startsWith('javascript') && href !== window.location.href)
        links.push({ label, href });
    });

    const prices = [];
    document.querySelectorAll('.product-card').forEach((card, i) => {
      const name  = card.querySelector('.product-name')?.textContent?.trim();
      const price = card.querySelector('.product-price')?.textContent?.trim();
      if (name && price)
        prices.push({ name, price, selector: `.product-card:nth-child(${i + 1}) .add-btn` });
    });

    return {
      url:     window.location.href,
      title:   document.title,
      text:    document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 4000),
      buttons: buttons.slice(0, 20),
      links:   links.slice(0, 50),
      prices:  prices.slice(0, 15),
    };
  }

  /*INTENT LAYER*/
  const INTENTS = {
    browsing:     { label: 'Просматривает',  desc: 'пользователь изучает страницу',      cls: 'browsing' },
    interested:   { label: 'Интересуется',   desc: 'пользователь рассматривает покупку', cls: 'interested' },
    ready_to_buy: { label: 'Готов купить',   desc: 'высокий шанс конверсии! 🔥',         cls: 'ready_to_buy' },
  };
  function updateIntent(intent) {
    const cfg = INTENTS[intent] || INTENTS.browsing;
    intentDot.className = cfg.cls;
    intentText.innerHTML = `<span id="aico-intent-label">${cfg.label}</span> — ${cfg.desc}`;
  }

  /* NAVIGATION — KEY FIX: widget never disappears */
  function isSameOrigin(url) {
    try { return new URL(url).origin === location.origin; }
    catch { return false; }
  }

  /**
   * SPA navigation for same-origin URLs.
   * Fetches new HTML, replaces body DOM, re-attaches widget elements.
   * The chat widget stays visible throughout — no page reload.
   */
  async function navigateSPA(url, description) {
    navBar.classList.add('visible');
    const loadMsg = addMessage(`⏳ Загружаю: ${description || url}…`, 'bot');

    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(html, 'text/html');

      // Update browser title & URL
      document.title = newDoc.title;
      history.pushState({ aicoSPA: true }, newDoc.title, url);
      headerSub.textContent = newDoc.title || url;

      // Swap body content (keep our widget elements safe)
      const newBodyHTML = newDoc.body.innerHTML;
      document.body.innerHTML = newBodyHTML;

      document.body.appendChild(btn);
      document.body.appendChild(panel);
      document.body.appendChild(browser);
      document.body.appendChild(cvPanel);
      document.body.appendChild(gestureToast);

      navBar.classList.remove('visible');
      loadMsg.remove();
      addMessage(`✅ Открыто: **${newDoc.title || url}**`, 'bot');

      newDoc.querySelectorAll('script:not([src])').forEach(s => {
        try { (0, eval)(s.textContent); } catch (_) {}
      });

    } catch (err) {
      navBar.classList.remove('visible');
      loadMsg.remove();
      // Fallback: open in iframe overlay
      openInBrowserIframe(url, description);
    }
  }

  function openInBrowserIframe(url, description) {
    currentNavUrl = url;
    browserUrlEl.textContent = url;
    browserFrame.style.display = 'block';
    browserBlocked.style.display = 'none';
    browserFrame.src = url;
    browser.classList.remove('hidden');

    // Widget floats above the browser overlay
    btn.style.zIndex = '999999';
    panel.style.zIndex = '999999';

    let checked = false;
    const timeout = setTimeout(() => { if (!checked) showBlocked(url); }, 4000);

    browserFrame.onload = () => {
      checked = true; clearTimeout(timeout);
      try {
        if (browserFrame.contentDocument?.location?.href === 'about:blank') showBlocked(url);
      } catch (_) {/* cross-origin = normal, page loaded */ }
    };
    browserFrame.onerror = () => { checked = true; clearTimeout(timeout); showBlocked(url); };
  }

  function showBlocked(url) {
    browserFrame.style.display = 'none';
    browserBlocked.style.display = 'flex';
    // Auto-open in new tab since iframe is blocked
    window.open(url, '_blank');
  }

  function closeBrowser() {
    browser.classList.add('hidden');
    browserFrame.src = '';
    btn.style.zIndex = '';
    panel.style.zIndex = '';
  }

  /** Main navigate function:*/
  async function executeNavigate(url, description) {
    if (isSameOrigin(url)) {
      await navigateSPA(url, description);
    } else {
      openInBrowserIframe(url, description);
    }
  }

  function navigateWithCountdown(url, description) {
    navCancelled = false;
    navDesc.textContent = description || 'Открываю страницу...';
    navBanner.classList.add('visible');

    let count = 3;
    navCountdown.textContent = count;

    navTimer = setInterval(() => {
      if (navCancelled) { clearInterval(navTimer); navBanner.classList.remove('visible'); return; }
      count--;
      navCountdown.textContent = count;
      if (count <= 0) {
        clearInterval(navTimer);
        navBanner.classList.remove('visible');
        executeNavigate(url, description);
      }
    }, 1000);
  }

  /* ACTION ENGINE*/
  function executeAction(action) {
    if (!action) return;
    try {
      if (action.type === 'navigate') {
        navigateWithCountdown(action.url, action.description);
        return;
      }

      const el = document.querySelector(action.selector);
      if (!el) return;

      if (action.type === 'click') {
        el.click();
        el.style.transition = 'all 0.3s';
        el.style.transform = 'scale(0.93)';
        setTimeout(() => { el.style.transform = ''; }, 320);
      } else if (action.type === 'scroll') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (action.type === 'fill' && action.value) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = action.value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      actionDesc.textContent = action.description || 'Действие выполнено';
      actionBanner.classList.add('visible');
      setTimeout(() => actionBanner.classList.remove('visible'), 4000);
    } catch (e) {
      console.error('[AI Copilot] Action error:', e);
    }
  }

  /* MESSAGES*/
  function addMessage(text, role) {
    const m = document.createElement('div');
    m.className = `aico-msg ${role}`;
    m.textContent = text;
    messagesEl.appendChild(m);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return m;
  }

  function typeMessage(text, role, linkSuggestions) {
    const m = document.createElement('div');
    m.className = `aico-msg ${role}`;
    messagesEl.appendChild(m);

    const cursor = document.createElement('span');
    cursor.className = 'aico-typing-cursor';

    let i = 0;
    const speed = Math.max(8, Math.min(28, 1400 / text.length));

    (function type() {
      if (i < text.length) {
        m.textContent = text.slice(0, ++i);
        m.appendChild(cursor);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        setTimeout(type, speed);
      } else {
        cursor.remove();
        if (linkSuggestions?.length) {
          const div = document.createElement('div');
          div.className = 'aico-link-suggestions';
          linkSuggestions.forEach(({ label, href }) => {
            const chip = document.createElement('button');
            chip.className = 'aico-link-chip';
            chip.textContent = label;
            chip.addEventListener('click', () => executeNavigate(href, label));
            div.appendChild(chip);
          });
          m.appendChild(div);
        }
      }
    })();
    return m;
  }

  function renderHistory() {
    messagesEl.innerHTML = '';
    history.forEach(m => addMessage(m.content, m.role === 'user' ? 'user' : 'bot'));
  }

  function setSuggestions(chips) {
    suggestEl.innerHTML = '';
    (chips || []).forEach(text => {
      const chip = document.createElement('button');
      chip.className = 'aico-chip';
      chip.textContent = text;
      chip.addEventListener('click', () => sendMessage(text));
      suggestEl.appendChild(chip);
    });
  }

  /*VOICE CONTROL — Web Speech API*/
  function initVoice() {
    if (!voiceOK) return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = navigator.language || 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('active');
      transcriptEl.classList.add('visible');
      transcriptTxt.textContent = 'Слушаю...';
    };

    recognition.onresult = e => {
      const text = Array.from(e.results).map(r => r[0].transcript).join('');
      inputEl.value = text;
      transcriptTxt.textContent = text || 'Слушаю...';
      if (e.results[e.results.length - 1].isFinal) {
        stopVoice();
        if (text.trim()) sendMessage(text.trim());
      }
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('active');
      transcriptEl.classList.remove('visible');
    };

    recognition.onerror = e => {
      stopVoice();
      if (e.error === 'not-allowed')
        addMessage('⛔ Нет доступа к микрофону. Разрешите доступ в настройках браузера.', 'error');
    };

    return true;
  }

  function startVoice() {
    if (!recognition && !initVoice()) {
      addMessage('⛔ Голосовой ввод не поддерживается в вашем браузере. Попробуйте Chrome.', 'error');
      return;
    }
    try { recognition.start(); } catch (_) {}
  }

  function stopVoice() {
    isListening = false;
    micBtn.classList.remove('active');
    transcriptEl.classList.remove('visible');
    try { recognition?.abort(); } catch (_) {}
  }

  function toggleVoice() {
    if (!isOpen) togglePanel(); // open chat first
    if (isListening) stopVoice();
    else startVoice();
  }

  /* COMPUTER VISION — MediaPipe Hands*/
  const GESTURE_MAP = {
    fist:      { icon: '✊', name: 'Кулак',           desc: 'Открыть / закрыть чат' },
    point:     { icon: '☝️',  name: 'Указательный',    desc: 'Голосовой ввод вкл/выкл' },
    thumbs_up: { icon: '👍',  name: 'Большой палец',   desc: 'Отправить сообщение' },
    peace:     { icon: '✌️',  name: 'Два пальца',      desc: 'Прокрутить вниз' },
    open_palm: { icon: '✋',  name: 'Открытая ладонь', desc: 'Стоп / отмена' },
    none:      { icon: '🤚',  name: 'Жест не найден',  desc: 'Покажите руку в камеру' },
  };

  /**
   * Landmark indices: thumb tip=4, index tip=8, middle tip=12, ring tip=16, pinky tip=20
   * PIP joints:       index pip=6, middle pip=10, ring pip=14, pinky pip=18
   */
  function detectGesture(lm) {
    // Determine handedness: if wrist is left of index MCP → right hand
    const rightHand = lm[0].x < lm[5].x;

    const thumbExt = rightHand
      ? lm[4].x < lm[2].x - 0.025
      : lm[4].x > lm[2].x + 0.025;

    const indexExt  = lm[8].y  < lm[6].y  - 0.02;
    const middleExt = lm[12].y < lm[10].y - 0.02;
    const ringExt   = lm[16].y < lm[14].y - 0.02;
    const pinkyExt  = lm[20].y < lm[18].y - 0.02;

    const count = [thumbExt, indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

    if (count === 0) return 'fist';
    if (count >= 4)  return 'open_palm';
    if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) return 'thumbs_up';
    if (!thumbExt && indexExt && !middleExt && !ringExt && !pinkyExt) return 'point';
    if (!thumbExt && indexExt && middleExt && !ringExt && !pinkyExt)  return 'peace';
    return 'none';
  }

  function drawHandOnCanvas(landmarks) {
    const ctx  = cvCanvas.getContext('2d');
    const W    = cvCanvas.width  = cvVideo.videoWidth  || 260;
    const H    = cvCanvas.height = cvVideo.videoHeight || 160;
    ctx.clearRect(0, 0, W, H);

    const pts = landmarks.map(lm => ({ x: (1 - lm.x) * W, y: lm.y * H }));

    const connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [0,9],[9,10],[10,11],[11,12],
      [0,13],[13,14],[14,15],[15,16],
      [0,17],[17,18],[18,19],[19,20],
      [5,9],[9,13],[13,17],[0,17],
    ];

    ctx.strokeStyle = 'rgba(102,126,234,0.85)';
    ctx.lineWidth = 2;
    connections.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    });

    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 0 ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = [4, 8, 12, 16, 20].includes(i) ? '#10b981' : '#667eea';
      ctx.fill();
    });
  }

  function updateCVStatus(gesture) {
    const cfg = GESTURE_MAP[gesture] || GESTURE_MAP.none;
    cvGestureIcon.textContent = cfg.icon;
    cvGestureName.textContent = cfg.name;
    cvGestureDesc.textContent = cfg.desc;
  }

  function triggerGestureAction(gesture) {
    if (gestureCool || gesture === 'none') return;
    if (gesture === lastGesture) return; // only fire on change
    lastGesture = gesture;

    // Show toast
    const cfg = GESTURE_MAP[gesture];
    gestureToast.textContent = `${cfg.icon} ${cfg.name} — ${cfg.desc}`;
    gestureToast.classList.add('visible');
    clearTimeout(gestureTimer);
    gestureTimer = setTimeout(() => gestureToast.classList.remove('visible'), 2200);

    // Cooldown to prevent rapid-fire
    gestureCool = true;
    setTimeout(() => { gestureCool = false; lastGesture = null; }, 1600);

    // Dispatch action
    switch (gesture) {
      case 'fist':      togglePanel(); break;
      case 'point':     toggleVoice(); break;
      case 'thumbs_up':
        if (inputEl.value.trim()) sendMessage(inputEl.value.trim());
        break;
      case 'peace':
        window.scrollBy({ top: 300, behavior: 'smooth' });
        break;
      case 'open_palm':
        stopVoice();
        navCancelled = true;
        clearInterval(navTimer);
        navBanner.classList.remove('visible');
        break;
    }
  }

  /** Process one video frame through MediaPipe */
  async function processFrame() {
    if (!cvActive) return;
    if (cvVideo.readyState >= 2) {
      try { await handsModel.send({ image: cvVideo }); } catch (_) {}
    }
    cvFrameId = requestAnimationFrame(processFrame);
  }

  /** Start computer vision: */
  async function startCV() {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }, audio: false,
      });
      cvVideo.srcObject = cameraStream;
      cvPanel.classList.add('visible');
      cvToggleBtn.classList.add('active');
      cvLoading.classList.remove('hidden');

      // Lazy-load MediaPipe Hands only when needed
      if (!window.Hands) {
        addMessage('📦 Загружаю модель компьютерного зрения (один раз)…', 'bot');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js');
      }

      handsModel = new window.Hands({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
      });
      handsModel.setOptions({
        maxNumHands:            1,
        modelComplexity:        0,   // 0 = Lite (faster)
        minDetectionConfidence: 0.65,
        minTrackingConfidence:  0.5,
      });
      handsModel.onResults(results => {
        const lms = results.multiHandLandmarks;
        if (lms && lms.length > 0) {
          drawHandOnCanvas(lms[0]);
          const g = detectGesture(lms[0]);
          updateCVStatus(g);
          triggerGestureAction(g);
        } else {
          const ctx = cvCanvas.getContext('2d');
          ctx.clearRect(0, 0, cvCanvas.width, cvCanvas.height);
          updateCVStatus('none');
        }
      });

      cvVideo.onloadedmetadata = () => {
        cvLoading.classList.add('hidden');
        cvActive = true;
        cvFrameId = requestAnimationFrame(processFrame);
        addMessage('✅ Камера активна! Используйте жесты для управления.', 'bot');
      };

    } catch (e) {
      cvLoading.classList.add('hidden');
      console.error('[AI Copilot] Camera error:', e);
      addMessage('⛔ Нет доступа к камере. Разрешите доступ в браузере и попробуйте снова.', 'error');
      stopCV();
    }
  }

  function stopCV() {
    cvActive = false;
    if (cvFrameId) { cancelAnimationFrame(cvFrameId); cvFrameId = null; }
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    if (handsModel)   { handsModel.close(); handsModel = null; }
    cvPanel.classList.remove('visible');
    cvToggleBtn.classList.remove('active');
    lastGesture = null;
  }

  /* SEND MESSAGE*/
  async function sendMessage(text) {
    if (!text.trim() || isBusy) return;

    addMessage(text, 'user');
    history.push({ role: 'user', content: text });
    inputEl.value = '';
    setSuggestions([]);
    setBusy(true);

    const thinking = addMessage('Думаю…', 'thinking');

    try {
      const res = await fetch(`${BACKEND}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message: text,
          history: history.slice(-8),
          page:    getPageContext(),
        }),
      });

      thinking.remove();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Ошибка сервера: ${res.status}`);
      }

      const data = await res.json();
      typeMessage(data.reply || 'Нет ответа.', 'bot', data.link_suggestions || []);
      history.push({ role: 'assistant', content: data.reply });

      if (data.intent)                  updateIntent(data.intent);
      if (data.action)                  setTimeout(() => executeAction(data.action), 700);
      if (data.suggestions?.length)     setTimeout(() => setSuggestions(data.suggestions), 400);

      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-20))); } catch (_) {}

    } catch (err) {
      thinking.remove();
      const isNet = /fetch|Failed|Network/i.test(err.message);
      addMessage(
        isNet
          ? `❌ Нет соединения с сервером (${BACKEND}).${MIXED_CONTENT ? '\n⚠️ HTTPS сайт + HTTP backend — браузер блокирует. Деплойте на Railway или используйте ngrok.' : '\nУбедитесь что backend запущен.'}`
          : `❌ ${err.message}`,
        'error',
      );
    } finally {
      setBusy(false);
    }
  }

  function setBusy(busy) {
    isBusy = busy;
    sendBtn.disabled = busy;
    inputEl.disabled = busy;
  }

  function togglePanel() {
    isOpen = !isOpen;
    panel.classList.toggle('hidden', !isOpen);
    btn.classList.toggle('open', isOpen);
    btn.innerHTML = isOpen ? iconClose() : iconChat();

    if (isOpen) {
      renderHistory();
      if (!history.length) {
        setTimeout(() => {
          typeMessage(
            'Привет! 👋 Я AI Copilot v4.\n\n' +
            '🗺️ Могу перемещаться по сайту — чат не пропадёт!\n' +
            '🎤 Нажмите микрофон для голосового ввода\n' +
            '👋 Нажмите 👋 в шапке для управления жестами\n\n' +
            'Чем могу помочь?',
            'bot',
          );
        }, 200);
        loadSmartSuggestions();
      }
      setTimeout(() => inputEl.focus(), 400);
    }
  }

  async function loadSmartSuggestions() {
    try {
      const res = await fetch(`${BACKEND}/suggestions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ page: getPageContext() }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions);
        if (data.intent_hint) updateIntent(data.intent_hint);
      }
    } catch {
      setSuggestions(['О чём эта страница?', 'Какие разделы есть?', 'Перейди на главную', '🎤 Голосовой режим']);
    }
  }

  function clearHistory() {
    history = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    messagesEl.innerHTML = '';
    typeMessage('История очищена. 😊 Чем могу помочь?', 'bot');
    loadSmartSuggestions();
    updateIntent('browsing');
  }

  btn.addEventListener('click', togglePanel);
  panel.querySelector('#aico-close').addEventListener('click', togglePanel);
  panel.querySelector('#aico-clear').addEventListener('click', clearHistory);
  sendBtn.addEventListener('click', () => sendMessage(inputEl.value));
  micBtn.addEventListener('click', toggleVoice);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e.target.value); }
  });

  cvToggleBtn.addEventListener('click', () => cvActive ? stopCV() : startCV());
  cvCloseBtn.addEventListener('click', stopCV);

  actionUndo.addEventListener('click', () => actionBanner.classList.remove('visible'));
  navCancel.addEventListener('click', () => {
    navCancelled = true; clearInterval(navTimer);
    navBanner.classList.remove('visible');
    addMessage('Навигация отменена.', 'bot');
  });

  browserClose.addEventListener('click', closeBrowser);
  browserBack.addEventListener('click', closeBrowser);
  browserOpen.addEventListener('click', () => { window.open(currentNavUrl, '_blank'); });

  window.addEventListener('popstate', e => {
    if (e.state?.aicoSPA) {
      headerSub.textContent = document.title;
    }
  });

  console.info(
    `%c[AI Copilot v4] Ready`,
    'color:#667eea;font-weight:bold',
    '\nBackend:', BACKEND,
    '\nVoice:', voiceOK ? '✅' : '❌ (unsupported)',
    '\nHTTPS:', isPageHttps ? '✅' : 'HTTP (local dev)',
    '\nMixed content warning:', MIXED_CONTENT ? '⚠️ YES' : 'no',
  );
})();
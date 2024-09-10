// ==UserScript==
// @name            Non-Stop YouTube For iOS
// @name:ja         YouTubeバックグラウンド再生
// @namespace       https://github.com/raven-e/YouTubeAdNonBlocker
// @version         0.1.0
// @description     Play YouTube background on your iPhone
// @description:ja  iPhoneでYouTubeをバックグラウンド再生します
// @author          Raven Engi
// @match           *://*.youtube.com/*
// @exclude         *://accounts.youtube.com/*
// @exclude         *://www.youtube.com/live_chat_replay*
// @exclude         *://www.youtube.com/persist_identity*
// @icon            https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @updateURL       https://github.com/raven-e/YouTubeAdNonBlocker/raw/main/NonStopYouTube4iOS.user.js
// @downloadURL     https://github.com/raven-e/YouTubeAdNonBlocker/raw/main/NonStopYouTube4iOS.user.js
// @require         https://cdn.jsdelivr.net/npm/qrcode_js@1.0.0/qrcode.min.js
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_addValueChangeListener
// @grant           GM_addElement
// @grant           window.onurlchange
// @run-at          document-body
// @sandbox         JavaScript
// @noframes
// @license MIT
// ==/UserScript==

(async function () {
  'use strict';

  window.addEventListener('load', async () => {
    createCSS();
    createDialog(document.body);
    createBtn(document.getElementById('center'));

    document.querySelector('.NonStopYT.btnArea .showModal').addEventListener('click', () => {
      let qrArea = document.querySelector('dialog.NonStopYT .qrcode span');
      qrArea.remove();
      qrArea = document.createElement('span');
      document.querySelector('dialog.NonStopYT .qrcode').appendChild(qrArea);

      let urlInfo = getVideoInfoFromUrl(window.location.href);
      urlInfo = { ...urlInfo, ...getPlayList(urlInfo.videoId) };
      if (!urlInfo.videoId) {
        return;
      }

      const url = createURL(urlInfo);
      document.querySelector('dialog.NonStopYT textarea').value = url;
      createQR(qrArea, url);

      const dialog = document.querySelector('dialog.NonStopYT');
      dialog.showModal();
    });

    const dialog = document.querySelector('dialog.NonStopYT');
    dialog.addEventListener('click', event => {
      var rect = dialog.getBoundingClientRect();
      var isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        dialog.close();
      }
    });
  });

  function getVideoInfoFromUrl(urlStr) {
    const url = new URL(urlStr);
    const urlParams = new URLSearchParams(url.search);

    let videoId = '';
    let listType = urlParams.get('listType');
    let list = urlParams.get('list');
    let index = urlParams.get('index');
    let loop = urlParams.get('loop');

    if (urlParams.has('v')) {
      videoId = urlParams.get('v');
    } else {
      const pathSegments = url.pathname.split('/');
      videoId = pathSegments[pathSegments.length - 1];
    }

    return { videoId, listType, list, index, loop };
  }

  function getPlayList(videoId = '') {
    let idList = [];
    let index = 1;

    // Get playlist items
    const l = document.querySelectorAll('ytd-playlist-panel-renderer#playlist #playlist-items a#thumbnail[href *= watch]');

    l.forEach(item => {
      const r = getVideoInfoFromUrl(item.href);
      if (r.videoId) idList.push(r.videoId);
    });

    if (videoId) {
      const i = idList.indexOf(videoId);
      if (i >= 0) {
        index = i + 1;
      } else {
        idList.unshift(videoId);
      }
    }

    return { idList, index };
  }

  function createURL(info) {
    let baseUrl = 'https://www.youtube-nocookie.com/embed/';
    const { videoId = '', idList = [] } = info;
    if (videoId) baseUrl += videoId;

    const params = {
      ...info, videoId: '', idList: '',
      // autoplay: 1, rel: 1,
    };

    if (idList.length && !params.listType) {
      params.list = '';
      params.listType = '';
      params.playlist = idList.join(',');
    }

    const url = new URL(baseUrl);
    for (const key in params) {
      if (!params[key]) continue;
      url.searchParams.set(key, params[key]);
    }

    return url.href;
  }

  function createQR(target, url = '') {
    new QRCode(target, url);
  }

  function createBtn(target) {
    const html = `<div class="NonStopYT btnArea"><button class="showModal">📲</button></div>`;

    addHtml(target, html);
  }

  function createDialog(target) {
    const html = `
      <dialog class="NonStopYT CtrlPanel" method="dialog">
        <form>
          <p class="qrcode"><span></span></p>
          <p>
            <textarea name="url" rows="3" cols="20"></textarea>
          </p>
          <p class="footer">
            <button value="cancel" formmethod="dialog">Cancel</button>
          </p>
        </form>
      </dialog>`;

    addHtml(target, html);
  }

  function createCSS() {
    const css = document.createElement('style');
    css.classList.add('NonStopYT');

    css.textContent = `
      .NonStopYT.btnArea button {
        background: none;
        border: none;
        font-size: 2em;
        text-align: center;
        margin: -2px 12px 0px 12px;
        cursor: pointer; outline: none;
      }
      .NonStopYT.btnArea button:hover {
        opacity: 0.8;
      }
      dialog.NonStopYT form p {
        margin-top: .6em;
        margin-bottom: .6em;
        display: flex;
        justify-content: space-evenly;
      }
      dialog.NonStopYT form p:first-child {
        margin-top: 0;
      }
      dialog.NonStopYT form textarea {
        display: block;
        width: 98%;
      }`;

    document.head.appendChild(css);
  }

  function addHtml(target, html = '') {
    let escapeHTMLPolicy = { createHTML: s => s };
    if (window.trustedTypes && window.trustedTypes.createPolicy && !window.trustedTypes.defaultPolicy) {
      escapeHTMLPolicy = window.trustedTypes.createPolicy('default', {
        createHTML: string => string,
        createScript: string => string,
        createScriptURL: string => string,
      });
    }

    const tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = escapeHTMLPolicy.createHTML(html);
    tmpDiv.childNodes.forEach(node => {
      if (node instanceof Element) target.appendChild(node);
    });
  }
})();

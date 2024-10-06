// ==UserScript==
// @name            Non-Stop YouTube For iOS
// @name:ja         iOS YouTube連続再生
// @namespace       https://github.com/raven-e/YouTubeAdNonBlocker
// @version         0.3.3
// @description     Play YouTube background on your iPhone
// @description:ja  iPhoneでYouTubeをバックグラウンド再生します
// @author          Raven Engi
// @match           *://*.youtube.com/*
// @exclude         *://accounts.youtube.com/*
// @exclude         *://studio.youtube.com/*
// @exclude         *://*.youtube.com/live_chat_replay*
// @exclude         *://*.youtube.com/persist_identity*
// @exclude         *://*.youtube.com/feed/history*
// @exclude         *://*.youtube.com/@*
// @icon            https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @updateURL       https://github.com/raven-e/YouTubeAdNonBlocker/raw/main/NonStopYouTube4iOS.user.js
// @downloadURL     https://github.com/raven-e/YouTubeAdNonBlocker/raw/main/NonStopYouTube4iOS.user.js
// @require         https://cdn.jsdelivr.net/npm/qrcode_js@1.0.0/qrcode.min.js
// @run-at          document-body
// @sandbox         JavaScript
// @grant        GM_setValue
// @grant        GM_getValue
// @noframes
// @license MIT
// ==/UserScript==

(async function () {
  'use strict';

  console.log('Non-Stop YouTube For iOS');

  window.addEventListener('load', async () => {
    // console.log('Loaded!');
    createCSS();
    createDialog(document.body);
    // waitForElm('.mobile-topbar-header-content.non-search-mode').then(elm => {
    //   createBtn(document.querySelector('.mobile-topbar-header-content.non-search-mode'), true);
    // });

    setInterval(function () {
      if (!document.querySelector('.NonStopYT.btnArea .showModal')) {
        if (document.querySelector('.mobile-topbar-header-content.non-search-mode')) {
          createBtn(document.querySelector('.mobile-topbar-header-content.non-search-mode'), true);
        } else {
          createBtn(document.getElementById('center'));
        }

        document.querySelector('.NonStopYT.btnArea .showModal').addEventListener('click', showQRCode);
      }

    }, 1000);

    const dialog = document.querySelector('dialog.NonStopYT');
    // Close dialog when click outside
    dialog.addEventListener('click', event => {
      var rect = dialog.getBoundingClientRect();
      var isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        dialog.close();
      }
    });

    const typeSelector = document.querySelector('dialog.NonStopYT select.baseUrlType');
    typeSelector.value = await GM_getValue('baseUrlType', '1');
    typeSelector.addEventListener('change', async event => {
      showQRCode();
      await GM_setValue('baseUrlType', typeSelector.value);
    });

    document.querySelector('dialog.NonStopYT .openUrl').addEventListener('click', event => {
      event.preventDefault();
      const url = document.querySelector('dialog.NonStopYT textarea').value;
      window.open(url, '_blank'); // Open in new tab
    });
  });

  function showQRCode() {
    let qrArea = document.querySelector('dialog.NonStopYT .qrcode span');
    qrArea.remove();
    qrArea = document.createElement('span');
    document.querySelector('dialog.NonStopYT .qrcode').appendChild(qrArea);

    let urlInfo = getVideoInfoFromUrl(window.location.href);
    urlInfo = { ...urlInfo, ...getPlayList(urlInfo.videoId) };

    if (!urlInfo.videoId) {
      if (urlInfo?.idList?.length) {
        urlInfo.videoId = urlInfo.idList[0];
      } else {
        return; // No videoId
      }
    }
    const baseUrlType = document.querySelector('dialog.NonStopYT select.baseUrlType').value;

    const url = baseUrlType === '1' ? createURLType1(urlInfo) : createURLType2(urlInfo);

    document.querySelector('dialog.NonStopYT textarea').value = url;
    createQR(qrArea, url);

    const dialog = document.querySelector('dialog.NonStopYT');
    dialog.showModal();
  }

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

    if (videoId.indexOf('list') !== -1) videoId = '';

    return { videoId, listType, list, index, loop };
  }

  function getPlayList(videoId = '') {
    let idList = [];
    let index = 1;

    // Get playlist items
    const pcList = 'ytd-playlist-panel-renderer#playlist #playlist-items a#thumbnail[href*=watch]';
    const spList1 = 'ytm-playlist-video-list-renderer .compact-media-item a.compact-media-item-image[href*=watch]';
    const spList2 = 'ytm-playlist-panel-renderer ytm-playlist-panel-video-renderer a.compact-media-item-image[href*=watch]';

    const l = document.querySelectorAll(`${pcList}, ${spList1}, ${spList2}`);

    l.forEach(item => {
      const r = getVideoInfoFromUrl(item.href);
      if (r.videoId) idList.push(r.videoId);
    });

    const limit = 10; // up to 15 items
    if (videoId) {
      const i = idList.indexOf(videoId);
      if (i >= 0) {
        if (i < limit) {
          index = i;
        } else {
          idList = idList.slice(i, i + limit);
        }
      } else {
        idList.unshift(videoId);
      }
    }
    idList = idList.slice(0, limit);

    console.log(idList, index);

    return { idList, index };
  }

  function createURLType1(info) {
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

  function createURLType2(info) {
    let baseUrl = 'https://raven-e.github.io/YouTubeAdNonBlocker/';
    const { videoId = '', idList = [] } = info;
    let index = 0;
    if (videoId) {
      if (idList.indexOf(videoId) === -1) {
        idList.unshift(videoId);
      } else {
        index = idList.indexOf(videoId);
      }
    }

    const params = {
      l: idList.join(','),
    };

    const url = new URL(baseUrl);
    for (const key in params) {
      if (!params[key]) continue;
      url.searchParams.set(key, params[key]);
    }
    url.hash = index;

    return url.href;
  }

  function createQR(target, url = '') {
    new QRCode(target, url);
  }

  function createBtn(target, prepend = false) {
    const html = `<div class="NonStopYT btnArea"><button class="showModal">📲</button></div>`;

    addHtml(target, html, prepend);
  }

  function createDialog(target) {
    // console.log('createDialog');
    const html = `
      <dialog class="NonStopYT CtrlPanel" method="dialog">
        <form>
          <p class="qrcode"><span></span></p>
          <p class="baseUrl">
            <select name="baseUrlType" class="baseUrlType">
              <option value="1">YouTube NoCookie</option>
              <option value="2">YouTube Ad NonBlocker</option>
            </select>
          </p>
          <p>
            <textarea name="url" rows="3" cols="20"></textarea>
          </p>
          <p>
            <button type="button" class="openUrl">Open &gt;</button>
            <!-- <a href="#" class="openUrl">Open &gt;</a> -->
          </p>
          <p class="footer">
            <button value="cancel" formmethod="dialog">Cancel</button>
          </p>
        </form>
      </dialog>`;

    addHtml(target, html);
  }

  function createCSS() {
    // console.log('createCSS');
    const css = document.createElement('style');
    css.classList.add('NonStopYT');

    css.textContent = `
      dialog.NonStopYT:-internal-dialog-in-top-layer::backdrop {
        position: fixed;
        inset: 0px;
        background: rgba(0, 0, 0, 0.5);
      }
      .NonStopYT button {
        cursor: pointer;
      }
      .NonStopYT.btnArea button {
        background: none; border: none; outline: none;
        font-size: 2em;
        text-align: center;
        margin: -2px 12px 0px 12px;
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
      dialog.NonStopYT form p.baseUrl {
        margin: 5px;
        font-size: 14px;
      }
      dialog.NonStopYT form .openUrl {
        background: none; border: none; outline: none;
        font-size: 16px;
        font-weight: bold;
        margin: 8px;
      }
      dialog.NonStopYT form .openUrl:hover {
        opacity: 0.6;
      }
      dialog.NonStopYT form textarea {
        display: block;
        width: 98%;
      }`;

    document.head.appendChild(css);
  }

  function addHtml(target, html = '', prepend = false) {
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
      if (node instanceof Element) {
        if (prepend) {
          target.prepend(node);
        } else {
          target.appendChild(node);
        }
      }
    });
  }

  function waitForElm(selector) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(mutations => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      // If you get "parameter 1 is not of type 'Node'" error, see https://stackoverflow.com/a/77855838/492336
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
})();

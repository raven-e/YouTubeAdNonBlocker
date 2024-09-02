// ==UserScript==
// @name         YouTube AD Non-Blocker
// @name:ja      YouTube広告ノンブロッカーDev
// @namespace    https://github.com/raven-e
// @version      0.1.0
// @description  Removes Adblock Thing
// @author       Raven Engi
// @match        *://*.youtube.com/*
// @match        *://*.youtube-nocookie.com/*
// @exclude      *://accounts.youtube.com/*
// @exclude      *://www.youtube.com/live_chat_replay*
// @exclude      *://www.youtube.com/persist_identity*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @updateURL    https://github.com/raven-e/YouTubeAdNonBlocker/raw/main/YouTubeAdNonBlocker.dev.js
// @downloadURL  https://github.com/raven-e/YouTubeAdNonBlocker/raw/main/YouTubeAdNonBlocker.dev.js
//// @require      https://www.youtube.com/iframe_api
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        window.onurlchange
// @grant        unsafeWindow
// @run-at       document-body
//// @run-at       document-start
//// @noframes
// @sandbox      JavaScript
// @license MIT
// ==/UserScript==

(async function () {
  'use strict';

  let uuid = GM_getValue('uuid');
  if (!uuid) {
    uuid = crypto.randomUUID().substring(0, Math.floor(Math.random() * 5) + 6).replace(/-/g, '');
    GM_setValue('uuid', uuid);
  }

  if (unsafeWindow[uuid]) {
    console.log('重复注入！');
    return;
  }

  // Initiating Default Settings
  const Config = {
    logLevel: 10, // 10: Debug, 20: Info, 30: Warning, 40: Error
    nonStop: true, // Remove "Video paused. Continue watching?" message
    removePageAds: true, // Remove Ads on page (not video)
    url: null, // Current URL
    videoPlayerUpdated: false, // if change YTPlayer to NoAdPlayer
    syncTimestamp: true, // Sync played timestamp to YouTube
  };

  log('YouTube AD Non-Blocker Running', 'i');

  // if (document.querySelector('.badge.badge-style-type-members-only')) {
  //   // Do nothing for member only video
  // } else
  if (window.top === window.self) {
    // Initiating Control Nodes container
    const CtrlNodes = {};
    const OriginVideoEventListeners = {};

    // let YTPlayer = document.querySelectorAll('video[src*="youtube.com"]')[0];
    let NoAdPlayerFrame = null;
    let YTPlayerForSync = null;
    // let memberOnlyFlg = document.querySelectorAll('.badge.badge-style-type-members-only').length > 0;

    async function observerCallback(mutations) {
      let isVideoAdded = mutations.some(mutation =>
        Array.from(mutation.addedNodes).some(node => node.tagName === 'VIDEO')
      );

      let isPlayListUpdated = mutations.some(mutation => {
        if (mutation.type === 'childList') {
          const target = mutation.target;
          if (target.classList.contains('ytd-playlist-panel-renderer')) {
            if (target.querySelector('a#thumbnail[href *= watch]')) {
              return true;
            }
          }
        }
      });

      if (isVideoAdded) {
        log("New video detected, checking for duplicates.");
        // Ignore for youtube shorts
        if (!isYTShorts() && !isMemberOnly()) {
          const videos = document.querySelectorAll('video[src*="youtube.com"]');

          muteAndPauseAllVideos(videos);
          clearAllOriginVideos(videos);
        }
      }

      if (isPlayListUpdated) {
        const videoInfo = await getVideoAndPlaylistInfo();
        log('Playlist updated.', 'w', videoInfo);

        if (videoInfo.tmpListStr && !videoInfo.playlist && !videoInfo.listType) {
          // const ifame = CtrlNodes.mainPlayer;
          // if (ifame) updateIFramePlayerUrl(ifame, { playlist: videoInfo.tmpListStr });
          // GM_setValue('playlist', videoInfo.tmpList).then();
        }
      }
    }
    const observer = new MutationObserver(observerCallback);
    observer.observe(document.body, { childList: true, subtree: true });

    listenTimestampLink(timestamp => {
      const iframe = CtrlNodes.mainPlayer;
      if (!iframe) return;
      updateIFramePlayerUrl(iframe, { start: timestamp });
    });

    // // SPA URL change event (Tampermonkey Only)
    // if (window.onurlchange === null) {
    //   window.addEventListener('urlchange', (info) => {
    //     log('URL changed:', 'a', info);
    //     memberOnlyFlg = document.querySelectorAll('.badge.badge-style-type-members-only').length > 0;
    //   });
    // }

    if (!isYTShorts() && !isMemberOnly()) {
      const videos = document.querySelectorAll('video[src*="youtube.com"]');
      if (videos.length) {
        muteAndPauseAllVideos(videos);
        clearAllOriginVideos(videos);
      }
    }

    GM_addValueChangeListener("testChannel", function (key, oldValue, newValue, remote) {
      console.log('[HOST] Got ValChange', { key, oldValue, newValue, remote });
      // GM_setValue("testChannel", `Hello from IFRAME${Date.now()}`);
    });

    GM_addValueChangeListener("videoEnded", async function (key, oldValue, newValue, remote) {
      if (!remote) return;
      await (new Promise(r => setTimeout(r, 1000)));

      const videoInfo = await getVideoAndPlaylistInfo();
      if (!videoInfo.tmpListStr) return;

      const playlist = videoInfo.tmpList.map(item => item.videoId);
      const currentIndex = playlist.indexOf(videoInfo.videoId);
      const nextIndex = currentIndex + 1;
      const nextLink = videoInfo.listLinks[nextIndex];

      if (nextLink) nextLink.click();
    });


    setInterval(async () => {

      if (window.location.href !== Config.url) {
        Config.url = window.location.href;
        clearAllIFramePlayers();
        // Config.videoPlayerUpdated = false;
        // clearAllPlayers();
        // YTPlayer = document.querySelectorAll('video[src*="youtube.com"]')[0];
        // log('URL changed:', 'a');
      }

      //if (!Config.videoPlayerUpdated) {
      if (!isYTShorts()) {
        if (isMemberOnly()) {
          if (CtrlNodes.originVideo) {
            clearAllIFramePlayers();
            reactiveOriginVideo();
          }
        } else {
          const videos = document.querySelectorAll('video[src*="youtube.com"]');
          if (videos.length) {
            muteAndPauseAllVideos(videos);
            clearAllOriginVideos(videos);
          }
        }
        // muteAndPauseAllVideos(videos);
        // clearAllOriginVideos(videos);
        // Config.videoPlayerUpdated = true;
      }
      //}


      // let videoInfo = {};
      // videoInfo = await getVideoAndPlaylistInfo();
      // log('Video and Playlist Info:', 'i', videoInfo);
      // if (!CtrlNodes.mainPlayer || !CtrlNodes.subPlayer) {
      //   videoInfo = await getVideoAndPlaylistInfo();
      //   log('Video and Playlist Info:', 'i', videoInfo);
      // }

      if (!CtrlNodes.mainPlayer) {
        if (isMemberOnly()) {
          if (CtrlNodes.originVideo) {
            clearAllIFramePlayers();
            reactiveOriginVideo();
          }
        } else {
          const videoInfo = await getVideoAndPlaylistInfo();
          if (videoInfo.videoId) {
            const iframe = await createIFramePlayer(videoInfo);
            decorateMainIFramePlayer(iframe);
            CtrlNodes.mainPlayer = iframe;
            // iframe.focus();
            log('Main iFrame player Added', 'w', iframe, 'isMemberOnly()', isMemberOnly());
          }
        }
      }

      // Mark video as watched
      if (!CtrlNodes.subPlayer && !isMemberOnly()) {
        CtrlNodes.subPlayer = true; // Prevent duplicate
        setTimeout(async () => {
          if (isMemberOnly()) return;

          const videoInfo = getVideoInfoFromUrl(window.location.href);
          if (!videoInfo.videoId) return;

          // const params = { videoId: videoInfo.videoId, autoplay: '1', startSeconds: 360, endSeconds: 365 };
          const params = { videoId: videoInfo.videoId, autoplay: '1', startSeconds: 99999 };
          const playTimes = await GM_getValue('videoTime', {});
          const { playTime, duration } = playTimes[videoInfo.videoId] || {};
          // if (playTime) {
          //   params.startSeconds = parseInt(playTime) - 2;
          //   params.endSeconds = parseInt(playTime);
          // }
          if (duration) {
            params.startSeconds = parseInt(duration) - 1;
          }

          const iframe = await createIFramePlayer(params, false);
          // const iframe = document.createElement('iframe');
          decorateSubIFramePlayer(iframe);
          CtrlNodes.subPlayer = iframe;

          // const subPlayer = new window.YT.Player(iframe.id, {
          //   events: {
          //     'onReady': () => { console.log('Sub player ready'); },
          //     // 'onStateChange': onPlayerStateChange
          //   }
          // });
          // log('Sub iFrame subPlayer', 'i', subPlayer);
          log('Sub iFrame player Added', 'i', iframe);

          setTimeout(() => {
            if (CtrlNodes.subPlayer) CtrlNodes.subPlayer.remove();
          }, 9000);
        }, 5000);
      }

      // log('This is YT', 'i', window.YT.Player);

      //updateIFramePlayerUrl(CtrlNodes.mainPlayer, { hash: `Hash-${Date.now()}` });
      //if (CtrlNodes.mainPlayer && !CtrlNodes.mainPlayerCtrl && window.YT?.Player) {
      //  const mainPlayer = new window.YT.Player(CtrlNodes.mainPlayer.id, {
      //    events: {
      //      'onReady': () => { console.log('Main iFrame player ready'); },
      //      // 'onStateChange': onPlayerStateChange
      //    }
      //  });
      //  // mainPlayer.setPlaybackRate(1.5)
      //  log('Main iFrame player created', 'i', mainPlayer);
      //  CtrlNodes.mainPlayerCtrl = mainPlayer;
      //}

      //log('This is info', 'i', YT);
      //log('This is info', 'i', window.YT);
      //log('This is debug');
      removePageAds();
      // resizeMiniPlayer();
      // resizeMiniPlayer({ transform: "scale(0.65) translate(120px, 100px)"});
      resizeMiniPlayer({ transform: "scale(0.75) translate(80px, 80px)" });

      // if (YTPlayer) {
      //   // log('YTPlayer:playbackRate', 'i', YTPlayer.playbackRate);
      //   log('YTPlayer:currentTime', 'i', YTPlayer.currentTime);
      //   // log('YTPlayer:duration', 'i', YTPlayer.duration);
      // }
    }, 1000);

    await cleanPlayTimeValue();

    function muteAndPauseAllVideos(videos) {
      log('Mute and pause videos', 'w');

      OriginVideoEventListeners.volumechange = (event) => {
        const video = event.target;
        if (!video.muted) {
          video.muted = true;
          //video.volume = 0;
          video.pause();
          log("Video unmuted detected and remuted", 'a', video);
        }
      };
      OriginVideoEventListeners.play = (event) => {
        const video = event.target;
        video.pause();
        log("Video play detected and repaused", 'a', video);
      };

      videos.forEach(video => {
        video.muted = true;
        //video.volume = 0;
        video.pause();

        video.addEventListener('volumechange', OriginVideoEventListeners.volumechange);
        video.addEventListener('play', OriginVideoEventListeners.play);
      });
    }

    function clearAllOriginVideos(videos) {
      log('Clear all videos container', 'w');
      videos.forEach(video => {
        // const con = video.closest('.html5-video-player');
        // if (con) con.querySelectorAll('div.ytp-gradient-bottom').forEach(div => div.remove());
        CtrlNodes.originVideo = video;
        video.remove();
      });
    }

    function reactiveOriginVideo() {
      if (CtrlNodes.originVideo) {
        const video = CtrlNodes.originVideo;
        video.removeEventListener('volumechange', OriginVideoEventListeners.volumechange);
        video.removeEventListener('play', OriginVideoEventListeners.play);

        video.muted = false;
        const videoPlayerElement = document.querySelector('.html5-video-player');
        videoPlayerElement.appendChild(video);
        video.play();
        CtrlNodes.originVideo = null;
        log('Reactive origin video', 'a', video);
      }
    }

    // Clear all iframe players
    function clearAllIFramePlayers() {
      document.querySelectorAll('iframe.YouTubeAdNonBlocker').forEach(iframe => iframe.remove());
      CtrlNodes.mainPlayer = null;
      CtrlNodes.subPlayer = null;
      log('Clear all iframe players', 'w');
    }

    async function createIFramePlayer(info, nocookieFlg = true) {
      let baseUrl = nocookieFlg ? 'https://www.youtube-nocookie.com/embed/' : 'https://www.youtube.com/embed/';
      if (info.videoId) baseUrl += info.videoId;

      const params = {
        autoplay: 1,
        modestbranding: 1,
        rel: 1,
      };
      if (info.autoplay) params.autoplay = info.autoplay;
      if (info.startSeconds) params.start = info.startSeconds;
      if (info.endSeconds) params.end = info.endSeconds;
      if (info.loop) params.loop = info.loop;
      if (info.playlist) params.playlist = info.playlist;
      if (info.listType && info.list) {
        params.listType = info.listType;
        params.list = info.list;
      }
      if (info.index) params.index = info.index;
      // if (info.tmpListStr && !params.playlist && !params.listType) params.playlist = info.tmpListStr;

      const url = new URL(baseUrl);
      for (const key in params) {
        if (key === 'hash') {
          url.hash = params[key];
          continue;
        }
        url.searchParams.set(key, params[key]);
      }

      const iframe = document.createElement('iframe');
      iframe.classList.add('YouTubeAdNonBlocker');
      iframe.setAttribute('src', url.href);

      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('allowfullscreen', true);
      iframe.setAttribute('mozallowfullscreen', "mozallowfullscreen");
      iframe.setAttribute('msallowfullscreen', "msallowfullscreen");
      iframe.setAttribute('oallowfullscreen', "oallowfullscreen");
      iframe.setAttribute('webkitallowfullscreen', "webkitallowfullscreen");

      return iframe;
    }

    function decorateMainIFramePlayer(iframe) {
      const iframeId = 'YouTubeAdNonBlocker-MainPlayer';
      iframe.setAttribute('id', iframeId);
      Object.assign(iframe.style, {
        position: 'absolute', pointerEvents: 'all',
        top: '0', left: '0', width: '100%', height: '100%', zIndex: '9999',
      });

      const videoPlayerElement = document.querySelector('.html5-video-player');
      videoPlayerElement.appendChild(iframe);
    }

    function decorateSubIFramePlayer(iframe) {
      const iframeId = 'YouTubeAdNonBlocker-SubPlayer';
      iframe.setAttribute('id', iframeId);
      Object.assign(iframe.style, {
        position: 'fixed', overflow: 'hidden',
        bottom: '20px', left: '20px',
        width: '300px', height: '200px', zIndex: '1000',
      });

      document.body.appendChild(iframe);
    }

    function updateIFramePlayerUrl(iframe, params = {}) {
      const url = new URL(iframe.src);
      const searchStrOrg = url.search;
      const hashOrg = url.hash;

      for (const key in params) {
        if (key === 'hash') {
          url.hash = params[key];
        } else {
          url.searchParams.set(key, params[key]);
        }
      }

      if (searchStrOrg !== url.search || hashOrg !== url.hash) {
        iframe.src = url.href;
        log('Update iFrame player URL:', 'i', searchStrOrg, '->', url.search);
      }
    }


    function getVideoInfoFromUrl(urlStr) {
      const url = new URL(urlStr);
      const urlParams = new URLSearchParams(url.search);

      const res = {};
      let videoId = '';
      let listType = urlParams.get('listType');
      let list = urlParams.get('list');
      let playlist = urlParams.get('playlist');
      let index = urlParams.get('index');
      let loop = urlParams.get('loop');

      if (urlParams.has('v')) {
        videoId = urlParams.get('v');
      } else {
        const pathSegments = url.pathname.split('/');
        const liveIndex = pathSegments.indexOf('live');
        if (liveIndex !== -1 && liveIndex + 1 < pathSegments.length) {
          videoId = pathSegments[liveIndex + 1];
        }
      }

      if (videoId) res.videoId = videoId;
      if (listType) res.listType = listType;
      if (list) res.list = list;
      if (playlist) res.playlist = playlist;
      if (index) res.index = index;
      if (loop) res.loop = loop;

      if (urlParams.has('t')) {
        const timestamp = (urlParams.get('t').match(/(\d+)s/i) || [])[1];
        if (timestamp) res.startSeconds = parseInt(timestamp);
      }

      return res;
    }


    async function getVideoAndPlaylistInfo(urlStr = window.location.href) {
      const res = getVideoInfoFromUrl(urlStr);
      const videoId = res.videoId;
      let tmpList = [];

      // Get last played timestamp
      if (!res.startSeconds) {
        const playTimeObj = await GM_getValue('videoTime', {});
        // log('PlayTimeObj:', 'i', playTimeObj);
        const playTime = playTimeObj[videoId]?.playTime;
        if (playTime) {
          res.startSeconds = parseInt(playTime) - 2;
        }
      }

      // Get playlist items
      const l = document.querySelectorAll('ytd-playlist-panel-renderer#playlist #playlist-items a#thumbnail[href *= watch]');

      l.forEach(item => {
        const r = getVideoInfoFromUrl(item.href);
        tmpList.push(r);
      });

      if (tmpList.length) {
        res.tmpList = tmpList;
        res.tmpListStr = tmpList.map(item => item.videoId).join(',');
        res.listLinks = l;
      }

      return res;
    }

    // listen timestamp link click event
    function listenTimestampLink(callback = null) {
      document.addEventListener('click', function (event) {
        const target = event.target;
        if (!target.matches('.yt-core-attributed-string__link[href*="&t="]')) return;
        event.preventDefault();

        const timeStr = (target.href.match(/\&t=(\d+)s/i) || [])[1];
        if (!timeStr) return;

        const timestamp = parseInt(timeStr);
        log(`Timestamp link clicked: ${timestamp} seconds`);
        if (callback) callback(timestamp);
      });
    }

    //removes ads on the page (not video player ads)
    function removePageAds(reset = false) {
      if (CtrlNodes.pageAdCss && !reset) return;

      const pageAdCss = document.createElement('style');
      pageAdCss.classList.add('YouTubeAdNonBlocker');
      pageAdCss.classList.add('pageAdCss');

      pageAdCss.textContent = `
      ytd-action-companion-ad-renderer,
      ytd-display-ad-renderer,
      ytd-video-masthead-ad-advertiser-info-renderer,
      ytd-video-masthead-ad-primary-video-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-ad-slot-renderer,
      yt-about-this-ad-renderer,
      yt-mealbar-promo-renderer,
      ytd-statement-banner-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-banner-promo-renderer-background
      statement-banner-style-type-compact,
      .ytd-video-masthead-ad-v3-renderer,
      div#root.style-scope.ytd-display-ad-renderer.yt-simple-endpoint,
      div#sparkles-container.style-scope.ytd-promoted-sparkles-web-renderer,
      div#main-container.style-scope.ytd-promoted-video-renderer,
      div#player-ads.style-scope.ytd-watch-flexy,
      ad-slot-renderer,
      ytm-promoted-sparkles-web-renderer,
      masthead-ad,
      tp-yt-iron-overlay-backdrop,
      #masthead-ad { display: none !important; }
      ytd-rich-item-renderer:has(ytd-ad-slot-renderer) { display: none !important; }`;

      document.head.appendChild(pageAdCss);
      CtrlNodes.pageAdCss = pageAdCss;

      log("Removed page ads (✔️)");
    }

    // Reduce miniplayer size
    function resizeMiniPlayer(css = { width: '250px', height: '180px' }) {
      if (CtrlNodes.miniPlayerCss) return;

      const cssNode = document.createElement('style');
      cssNode.classList.add('YouTubeAdNonBlocker');
      cssNode.classList.add('miniPlayerCss');

      let cssStr = '';
      for (const key in css) {
        cssStr += `${key}: ${css[key]} !important;`;
      }

      cssNode.textContent = `ytd-miniplayer.ytd-app { ${cssStr}}`;
      document.head.appendChild(cssNode);
      CtrlNodes.miniPlayerCss = cssNode;

      log("Resized miniplayer (✔️)");
    }

    function addPlayBackRateBtn() {

      const style = document.createElement('style');
      style.textContent = `
        .YouTubeAdNonBlocker.btnArea {
          display: flex; align-items: center; margin:10px;
        }
        .YouTubeAdNonBlocker.btnArea button {
          background-color: rgba(0, 0, 0, 0.4);
          font-size: 1.5em;
          text-align: center;
          color: white; border: none;
          width: 25px; height: 25px;
          cursor: pointer; outline: none;
        }
        .YouTubeAdNonBlocker.btnArea button:hover { opacity: 0.8; }
        .YouTubeAdNonBlocker.btnArea button.minus { border-radius: 15px 0 0 15px; }
        .YouTubeAdNonBlocker.btnArea button.plus { border-radius: 0 15px 15px 0; }
        .YouTubeAdNonBlocker.btnArea span {
          background-color: rgba(0, 0, 0, 0.35);
          display: inline-block;
          color: white;
          font-size: 1.5em;
          text-align: center;
          width: 40px; height: 21px; padding-top: 4px;
        }
        .YouTubeAdNonBlocker.btnArea button.conf {
          background: none;
          border: none;
        }
      `;
      style.classList.add('YouTubeAdNonBlocker');
      style.classList.add('btnArea');
      document.head.appendChild(style);
      
      const btnArea = document.createElement('div');
      btnArea.classList.add('YouTubeAdNonBlocker');
      btnArea.classList.add('btnArea');
      const plusBtn = document.createElement('button');
      plusBtn.classList.add('plus');
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', async () => {
        const playbackRate100 = Math.round((await GM_getValue('playbackRate', 1.0) * 100));
        const newRate = (playbackRate100 + 5) / 100;
        GM_setValue('playbackRate', newRate);
        document.querySelector('.YouTubeAdNonBlocker.btnArea span.playbackRate').textContent = newRate;
      });
      const minusBtn = document.createElement('button');
      minusBtn.classList.add('minus');
      minusBtn.textContent = '-';
      minusBtn.addEventListener('click', async () => {
        const playbackRate100 = Math.round((await GM_getValue('playbackRate', 1.0) * 100));
        const newRate = (playbackRate100 - 5) / 100;
        GM_setValue('playbackRate', newRate);
        document.querySelector('.YouTubeAdNonBlocker.btnArea span.playbackRate').textContent = newRate;
      });
      const confBtn = document.createElement('button');
      confBtn.classList.add('conf');
      confBtn.textContent = '⚙️';
      confBtn.addEventListener('click', function () {});
      const playbackRate = document.createElement('span');
      playbackRate.classList.add('playbackRate');
      playbackRate.textContent = GM_getValue('playbackRate', 1.0);
      btnArea.appendChild(minusBtn);
      btnArea.appendChild(playbackRate);
      btnArea.appendChild(plusBtn);
      btnArea.appendChild(confBtn);

      document.getElementById('center').appendChild(btnArea);

      // var pbs = document.createElement("INPUT");
      // pbs.type = "number";
      // pbs.style = "background-color: rgba(0, 0, 0, 0.35); color: white; border: none; border-radius: 10px; cursor: pointer; overflow: hidden; outline: none; width: 5ch; text-align: center; font-size: auto; -webkit-appearance: textfield; -moz-appearance: textfield;";
      // pbs.title = "Playback speed";
      // var incrementButton = document.createElement("BUTTON");
      // incrementButton.textContent = "+";
      // incrementButton.style = "background-color: rgba(0, 0, 0, 0.5); color: white; border: none; cursor: pointer; outline: none; font-size: 1.5em;";
      // incrementButton.addEventListener("click", function () { pbs.stepUp(); var event = new Event("change", { bubbles: true, cancelable: true }); pbs.dispatchEvent(event); });
      // var decrementButton = document.createElement("BUTTON");
      // decrementButton.textContent = "-";
      // decrementButton.style = "background-color: rgba(0, 0, 0, 0.5); color: white; border: none; cursor: pointer; outline: none; font-size: 1.5em;";
      // decrementButton.addEventListener("click", function () { pbs.stepDown(); var event = new Event("change", { bubbles: true, cancelable: true }); pbs.dispatchEvent(event); });
      // var container = document.createElement("DIV");
      // container.style = "display: flex; align-items: center; margin:10px;";
      // const span = document.createElement('span');
      // span.style = "color: white; font-size: 1.5em;";
      // span.textContent = '⚙️';
      // container.appendChild(span);
      // container.appendChild(decrementButton);
      // container.appendChild(pbs);
      // container.appendChild(incrementButton);
      // pbs.step = 0.1;
      // pbs.min = 0;
      // pbs.value = 1.0;
      // pbs.addEventListener("change", function () { if (pbs.value > 0) { /* document.getElementsByTagName("video")[0]?.playbackRate = pbs.value; */ } else { pbs.value = 1; /* document.getElementsByTagName("video")[0]?.playbackRate = pbs.value;*/ } });
      // document.getElementById('center').appendChild(container);
    }

    setTimeout(() => {
      addPlayBackRateBtn();
    }, 5000);
  } else {
    console.log('iframe testChannel', GM_getValue('testChannel', null));
    // GM_setValue("testChannel", `Hello from IFRAME${Date.now()}`);
    // var listenerId = GM_addValueChangeListener("testChannel", function (key, oldValue, newValue, remote) {
    //   console.log('[iFrame] Got ValChange', { key, oldValue, newValue, remote });
    //   // GM_setValue("testChannel", `Hello from IFRAME${Date.now()}`);
    // });

    if (window.location.host.includes('youtube-nocookie')) {

      window.addEventListener('load', async function () {
        const videoPlayer = document.querySelector('video');
        const videoId = getVideoId();

        GM_addValueChangeListener("playbackRate", async function (key, oldValue, newValue, remote) {
          if (remote) {
            videoPlayer.playbackRate = newValue;
            log("PlaybackRate changed", 'i', videoPlayer.playbackRate);
          }
        });

        videoPlayer.playbackRate = await GM_getValue('playbackRate', 1.0);
        log("PlaybackRate set as", 'i', videoPlayer.playbackRate);
        GM_setValue("testChannel", 'Video: ' + videoPlayer.src);

        videoPlayer.addEventListener("ratechange", async (event) => {
          const videoPlayer = event.target;
          log("PlaybackRate changed", 'i', videoPlayer.playbackRate);
          await GM_setValue('playbackRate', videoPlayer.playbackRate);
        });

        videoPlayer.addEventListener("pause", async (event) => {
          log("Video paused", 'i');
          // not working...
          updateOtherVideoLinks();
        });

        videoPlayer.addEventListener("ended", async (event) => {
          // const videoPlayer = event.target;
          log("Video ended", 'i');

          await GM_setValue("videoEnded", { videoId, timestamp: Date.now() });

          // const playlist = await GM_getValue('playlist', []);
          // const videoIdList = playlist.map(item => item.videoId);
          // const currentIndex = videoIdList.indexOf(videoId);
          // const nextIndex = currentIndex + 1;

          // log("Playlist", 'i', playlist);
          // log("VideoId", 'i', videoId);
          // log("Current Index", 'i', currentIndex);

          // if (videoIdList[nextIndex]) {
          //   const nextVideoId = videoIdList[nextIndex];
          //   log("Next VideoId", 'i', nextVideoId);

          //   const nextUrl = `https://www.youtube.com/watch?v=${nextVideoId}`;

          //   const a = document.createElement('a');
          //   a.href = nextUrl;
          //   a.target = '_parent';
          //   document.body.appendChild(a);
          //   a.click();
          // }
        });

        this.setInterval(async () => {
          if (!videoPlayer.paused && videoPlayer.currentTime > 0) {
            const playTimeObj = await GM_getValue('videoTime', {});
            // const playTime = playTimeObj[videoId]?.playTime;
            const playTime = videoPlayer.currentTime;
            const duration = videoPlayer.duration;
            const lastModified = Date.now();

            playTimeObj[videoId] = { playTime, duration, lastModified };
            await GM_setValue('videoTime', playTimeObj);
            // log("Video playing", 'i', playTimeObj);
          }
        }, 2000);
      })

      // setTimeout(function () {
      //   const videoPlayer = document.querySelector('video');
      //   GM_setValue("testChannel", 'Video: ' + videoPlayer.src);
      //   videoPlayer.playbackRate = 1.5;
      // }, 5000);

      function updateOtherVideoLinks() {
        const links = document.querySelectorAll('a[target="_blank"]');
        links.forEach(link => {
          link.target = '_parent';
        });
      }
    } else if (window.location.host.includes('youtube.com')) {
      console.log('YT iframe !!!!');
      window.addEventListener('load', async function () {
        const videoPlayer = document.querySelector('video');
        if (!videoPlayer) return;

        videoPlayer.muted = true;
        videoPlayer.volume = 0;
        // const videoId = getVideoId();

        videoPlayer.addEventListener('play', async (event) => {
          const video = event.target;
          video.muted = true;
          videoPlayer.volume = 0;
          video.playbackRate = 2.0;
        });

        videoPlayer.onloadeddata = () => {
          log('Video player loaded', 'i');
          videoPlayer.play();
        };
      });
    }

    function getVideoId() {
      const url = new URL(window.location.href);
      return url.pathname.replace('/embed/', '');
    }
    // log('iframe origin', '', window.location.href);
  }

  async function cleanPlayTimeValue() {
    const cleanedAt = await GM_getValue('videoTimeCleanedAt', 0);
    const currentTime = Date.now();
    if ((currentTime - cleanedAt) < 24 * 60 * 60 * 1000) return;

    const playTimeObj = await GM_getValue('videoTime', {});
    for (const videoId in playTimeObj) {
      const lastModified = playTimeObj[videoId].lastModified;
      if ((currentTime - lastModified) > 30 * 24 * 60 * 60 * 1000) {
        delete playTimeObj[videoId];
      }
    }
    await GM_setValue('videoTime', playTimeObj);
    await GM_setValue('videoTimeCleanedAt', currentTime);
  }

  // async function findPlayTimeObj(videoId) {
  //   const timeList = await GM_getValue('videoTime', []);
  //   const timeObj = timeList.find(item => item.videoId === videoId) || {};
  //   return { videoId, timeList, timeObj };
  // }

  // If is playing youtube shorts
  function isYTShorts() {
    if (window.location.href.includes('shorts')) {
      log('Youtube shorts detected, ignoring...', 'i');
      return true;
    }
  }

  // If is member only video
  function isMemberOnly() {
    if (document.querySelector('#title .badge.badge-style-type-members-only')) {
      log('Member only video detected, ignoring...', 'i');
      return true;
    }
  }

  // Log Function
  function log(log, level, ...args) {
    const prefix = '🔧[YTAD-NonBlocker]: ';
    const message = `${prefix} ${log}`;
    switch (level) {
      case 'error':
      case 'e':
        if (Config.logLevel <= 40) console.error(`❌ ${message}`, ...args);
        break;
      case 'warning':
      case 'w':
        if (Config.logLevel <= 30) console.warn(`⚠️ ${message}`, ...args);
        break;
      case 'info':
      case 'i':
        if (Config.logLevel <= 20) console.info(`ℹ️ ${message}`, ...args);
        break;
      default:
        if (Config.logLevel <= 10) console.log(`✅ ${message}`, ...args);
    }
  }
})();

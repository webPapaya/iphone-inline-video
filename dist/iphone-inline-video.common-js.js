'use strict';

function getIntervalometer(cb) {
	var raf = {
		start: function start() {
			if (!raf.lastCall) {
				raf.lastCall = Date.now();
			}
			cb(Date.now() - raf.lastCall);
			raf.lastCall = Date.now();
			raf.id = requestAnimationFrame(raf.start);
		},
		stop: function stop() {
			cancelAnimationFrame(raf.id);
			delete raf.id;
			delete raf.lastCall;
		}
	};
	return raf;
}

function preventEvent(element, eventName, toggleProperty, preventWithProperty) {
	var handler = function handler(e) {
		var hasProperty = toggleProperty && element[toggleProperty];
		delete element[toggleProperty];
		if (Boolean(hasProperty) === Boolean(preventWithProperty)) {
			e.stopImmediatePropagation();
			// console.log(eventName, 'prevented on', element);
		}
	};
	element.addEventListener(eventName, handler, false);
	return {
		forget: function forget() {
			return element.removeEventListener(eventName, handler, false);
		}
	};
}

function proxyProperty(object, propertyName, sourceObject) {
	Object.defineProperty(object, propertyName, {
		get: function get() {
			return sourceObject[propertyName];
		},
		set: function set(va) {
			sourceObject[propertyName] = va;
		}
	});
}

var isNeeded = /iPhone|iPod/i.test(navigator.userAgent);

/**
 * UTILS
 */

function getAudioFromVideo(video) {
	var audio = new Audio();
	audio.src = video.currentSrc || video.src;
	return audio;
}
function update(timeDiff) {
	// console.log('update')
	var player = this;
	if (player.audio) {
		var audioTime = player.audio.currentTime;
		player.video.currentTime = audioTime;
		// console.assert(player.video.currentTime === audioTime, 'Video not updating!')
	} else {
			var nextTime = player.video.currentTime + timeDiff / 1000;
			player.video.currentTime = Math.min(player.video.duration, nextTime);
		}
	if (player.video.ended) {
		player.video.pause();
	}
}
function startVideoBuffering(video) {
	// this needs to be inside an event handler
	video.iaAutomatedEvent = true;
	video._play();
	setTimeout(function () {
		video.iaAutomatedEvent = true;
		video._pause();
	}, 0);
}

/**
 * METHODS
 */

function play() {
	// console.log('play')
	var video = this;
	var player = video.__ivp;
	if (!video.buffered.length) {
		// console.log('Video not ready. Buffering')
		startVideoBuffering(video);
	}
	player.paused = false;
	if (player.audio) {
		player.audio.play();
	} else if (video.currentTime === video.duration) {
		video.currentTime = 0;
	}
	player.updater.start();

	video.dispatchEvent(new Event('play'));
	video.dispatchEvent(new Event('playing'));
}
function pause() {
	// console.log('pause')
	var video = this;
	var player = video.__ivp;
	player.paused = true;
	player.updater.stop();
	if (player.audio) {
		player.audio.pause();
	}
	video.dispatchEvent(new Event('pause'));
	if (video.ended) {
		video.dispatchEvent(new Event('ended'));
	}
}

/**
 * SETUP
 */

function addPlayer(video, hasAudio) {
	var player = video.__ivp = {};
	player.paused = true;
	player.loop = video.loop;
	player.muted = video.muted;
	player.video = video;
	if (hasAudio) {
		player.audio = getAudioFromVideo(video);
	}
	player.updater = getIntervalometer(update.bind(player));

	// stop programmatic player when OS takes over
	video.addEventListener('webkitbeginfullscreen', function () {
		// @todo: should be on play?
		video.pause();
	});
	if (player.audio) {
		// sync audio to new video position
		video.addEventListener('webkitendfullscreen', function () {
			// @todo: should be on pause?
			player.audio.currentTime = player.video.currentTime;
			// console.assert(player.audio.currentTime === player.video.currentTime, 'Audio not synced');
		});
	}
}

function overloadAPI(video) {
	var player = video.__ivp;
	video._play = video.play;
	video._pause = video.pause;
	video.play = play;
	video.pause = pause;
	proxyProperty(video, 'paused', player);
	proxyProperty(video, 'loop', player);
	proxyProperty(video, 'muted', player);
	preventEvent(video, 'seeking');
	preventEvent(video, 'seeked');
	preventEvent(video, 'play', 'iaAutomatedEvent', true);
	preventEvent(video, 'playing', 'iaAutomatedEvent', true);
	preventEvent(video, 'pause', 'iaAutomatedEvent', true);
}

function index ( /* makeVideoPlayableInline*/video) {
	var hasAudio = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];
	var onlyWhenNeeded = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

	if (onlyWhenNeeded && !isNeeded) {
		return;
	}
	addPlayer(video, hasAudio);
	overloadAPI(video);
	// console.log('Video will play inline');
}

module.exports = index;
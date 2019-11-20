"use strict";

(function() {

	var trace = tortilla.trace.bind(tortilla);
	trace(tortilla.VERSION + " starting up");

	tortilla.sharedInit();

	var ua = navigator.userAgent;
	var isIE = ua.indexOf("MSIE ") != -1 || ua.indexOf("Trident/") != -1;
	var isIEorEDGE = isIE || ua.indexOf('Edge/') != -1;

	var fpsMeter = null;

	tortilla.isVisible = function() {
		return Visibility.state() == "visible";
	};

	tortilla.loadScript = function (url, done) {
		$.getScript(url)
			.done(function() {
				done(true);
			})
			.fail(function(jqxhr, settings, exception) {
				done(false, exception);
			});
	};

	tortilla.setCursor = function(cursor) {
		$(document.body).css("cursor", cursor);
	};

	tortilla.fullscreenSupported = screenfull.enabled;

	tortilla.isFullscreen = function() {
		return screenfull.isFullscreen;
	};

	tortilla.setFullscreen = function(fs) {
		if (fs == this.isFullscreen) return;
		if (fs) screenfull.request();
		else screenfull.exit();
	};

	tortilla.openUrl = function(url) {
		window.open(url);
	};

	tortilla.parameters.insert(parseUrl().params);

	tortilla.isWebGLSupported = function() {

		// check if it's known at all
		if (!("WebGLRenderingContext" in window)) return false;

		// --- check if a context can be created
		var canvas = tortilla.createBuffer(100,100);
		var opts = {failIfMajorPerformanceCaveat: true};
		// first with the proper name
		var context = canvas.getContext("webgl", opts);
		if (context != null) return true;
		// also try the old name
		context = canvas.getContext("experimental-webgl", opts);
		if (context != null) return true;

		// not today
		return false;

	};

	tortilla.countFrameRendered = function() {
		if (fpsMeter != null) fpsMeter.tick();
	};

	var preInitSteps = 2;

	Visibility.onVisible(function() {
		if (Visibility.isSupported()) {
			Visibility.change(function(e) {
				tortilla.dispatchEvent(tortilla.EV_VISIBILITY_CHANGED, [tortilla.isVisible()]);
			});
		}
		initStepDone();
	});

	if (screenfull.enabled) {
		$(document).on(screenfull.raw.fullscreenchange, function () {
			tortilla.dispatchEvent(tortilla.EV_FULLSCREEN_CHANGED, [tortilla.isFullscreen()]);
		});
	}

	function initStepDone() {
		preInitSteps--;
		if (preInitSteps == 0) start();
	}

	$(document).ready(function() {
		if (tortilla.FONTS.length == 0) initStepDone();
		else {
			trace("Loading fonts");
			WebFont.load({
				custom: {
					families: tortilla.FONTS,
					urls: ["fonts.css?v=" + tortilla.BUILD_TIME]
				},
				active: function() {
					trace("Fonts loaded");
					initStepDone();
				},
				inactive: function() {
					trace("Fonts not loaded");
					initStepDone();
				}
			});
		}
	});

	function start() {

		var game = tortilla.game;

		var gs = typeof(game.settings) === "function" ? game.settings() : {};
		tortilla.namespace = gs.namespace;

		var jCanvas = $("<canvas/>");
		//$(document.body).append(jCanvas);
		$('#wrap').append(jCanvas);

		var canvas = jCanvas[0];
		tortilla.canvas = canvas;
		var prevOrientation = window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape";
		var resizeTimeOut = null;

		if (gs.noContext) {
			tortilla.context = null;
			tortilla.contextType = null;
		} else {
			var context;
			var ct;
			var ctReal;
			if (gs.tryWebGL && "WebGLRenderingContext" in window) {
				context = canvas.getContext("experimental-webgl");
				if (context != null) {
					ct = "webgl";
					ctReal = "experimental-webgl";
				} else {
					context = canvas.getContext("webgl");
					if (context != null) {
						ct = ctReal = "webgl";
					} else {
						ct = ctReal = "2d";
					}
				}
			} else {
				ct = ctReal = "2d";
			}
			tortilla.context = canvas.getContext(ctReal);
			tortilla.contextType = ct;
		}

		if (gs.showFps) {
			fpsMeter = new FPSMeter();
		}

		var win = $(window);

		var dpr;
		if (window.devicePixelRatio) dpr = window.devicePixelRatio;
		else dpr = 1;

		tortilla.windowToCanvas = function(x, y) {
			return new tortilla.Point(x*dpr,y*dpr);
		};

		if (!gs.hasOwnProperty("canvasMinWidth")) gs.canvasMinWidth = 1;
		if (!gs.hasOwnProperty("canvasMinHeight")) gs.canvasMinHeight = 1;
		if (!gs.hasOwnProperty("mobileResizeRestrictions"))	gs.mobileResizeRestrictions = false;
		function sizeCanvas() {
			resizeTimeOut = null;
			var ww = $('#wrap').width();
			var wh = $('#wrap').height();

			var ow = canvas.width;
			var oh = canvas.height;

			trace("canvas size " + ww + "x" + wh);

			var oversize = false;
			var cw = ww * dpr;
			var ch = wh * dpr;

			var newOrientation = window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape";
			if(gs.mobileResizeRestrictions) { // only apply these restrictions if the setting is used
				if(newOrientation == "portrait") {
					cw = wh * dpr;
					ch = ww * dpr;
				} 
				if(newOrientation == "portrait" && prevOrientation == "landscape") {
					//Once you're in landscape, don't go back
					trace('Tortilla prevented resize from going to portrait!');
					prevOrientation = newOrientation;
					return;
				} else if(!(newOrientation == "landscape" && prevOrientation == "portrait") && (cw == ow && ch < oh * 0.6)) {
					prevOrientation = newOrientation;
					return; //TODO: this is a workaround for soft keyboard resize. there has to be a better way
				}
			}
			if (cw < gs.canvasMinWidth) {
				cw = gs.canvasMinWidth;
				oversize = true;
			}
			if (ch < gs.canvasMinHeight) {
				ch = gs.canvasMinHeight;
				oversize = true;
			}

			prevOrientation = newOrientation;
			canvas.width = cw;
			canvas.height = ch;
			jCanvas.css({width: (cw/dpr) + "px", height: (ch/dpr) + "px"});
			$("html, body").css("overflow", oversize ? "auto": "hidden");

			tortilla.dispatchEvent(tortilla.EV_RESIZED, []);

		}
		win.resize(function() { if(resizeTimeOut == null) resizeTimeOut = setTimeout(sizeCanvas, 100); });
		sizeCanvas();

		// prevent input events
		function pd(e) {
			var elem, evt = e ? e:event;
			if (evt.srcElement)  elem = evt.srcElement;
			else if (evt.target) elem = evt.target;
			// console.log("pd: elem.tagName: " + elem.tagName);
			if (elem.tagName != "INPUT" && elem.tagName != "VIDEO" && elem.tagName != "A") e.preventDefault();
		}
		function focusAndPd(e) {
//			console.log("CLICK! hasFocus", document.hasFocus(), "isIE", isIE);
			if (isIE || !document.hasFocus()) { // naturally misbehaves in IE. hasFocus returns true in an iframe, when the parent has focus but the iframe does not :-/
//				console.log("activeElement before", document.activeElement);
				//window.focus();
//				console.log("activeElement after", document.activeElement);
			}
			pd(e);
		}

		document.addEventListener("mousedown", focusAndPd, {passive:false});
		document.addEventListener("click", pd, {passive:false});
		document.addEventListener("dblclick", pd, {passive:false});
		document.addEventListener("mouseup", pd, {passive:false});
		document.addEventListener("wheel", pd, {passive:false});
		//
		// document.addEventListener("touchstart", focusAndPd, {passive:false});
		// document.addEventListener("touchcancel", pd, {passive:false});
		// document.addEventListener("touchend", pd, {passive:false});
		// document.addEventListener("touchenter", pd, {passive:false});
		// document.addEventListener("touchleave", pd, {passive:false});
		// document.addEventListener("touchmove", pd, {passive:false});

		// window.addEventListener("focus", function() { console.log("WINDOW FOCUSED"); });
		// window.addEventListener("blur", function() { console.log("WINDOW BLURRED"); });

		function kpd(e) {
//			console.log("kpd", e);
			var blocked = [
			               37,38,39,40, // arrows
			               32 // space
			];
			if (blocked.indexOf(e.keyCode) != -1 && !(e.target instanceof HTMLInputElement)) {
//				console.log("PD!");
				e.preventDefault();
			}
		}
		document.addEventListener("keydown", kpd);
		document.addEventListener("keyup", kpd);
//		document.addEventListener("keypress", kpd);

		if (typeof(game.init) === "function")
			game.init();

		if (typeof(game.frame) === "function") {

			var minFps = gs.hasOwnProperty("minFps") ? gs.minFps : 15;

			var preciseTime = "performance" in window && "now" in window.performance;
			trace("Using precision timer: " + preciseTime);
			var time = preciseTime ? performance.now() : Date.now();
			var frame = null; frame = function() {

				var context = tortilla.context;
//				var context = canvas.getContext(ctReal);

				var now = preciseTime ? performance.now() : Date.now();
				var dt = Math.max(0.0001, Math.min(1/minFps, (now-time)/1000));
				time = now;

				try {
					game.frame(context, dt);
					if (fpsMeter != null && !gs.manualFpsCount) tortilla.countFrameRendered();
				} catch (e) {
					console.log("Error in frame", e);
					if (e instanceof Error && e.message) console.error(e.message);
					if (e instanceof Error && e.stack) console.error(e.stack);
					debugger;
					//if (42 < 1) alert("The end is here"); // you can place a breakpoint on this line
				}
				requestAnimationFrame(frame);

			};
			requestAnimationFrame(frame);

		}

	}

	function parseUrl() {

		// url params and self url
		var params = {};
		console.log(location);
		var selfUrl = location.href;
		for (var i = 0; i < 2; i++) {

			// # params come after ? params, so do # first (working from the back of the url string)
			var parChar = i == 0 ? "#" : "?";

			// extract param string
			var qin = selfUrl.indexOf(parChar);
			if (qin != -1) {

				var urlPartParams = selfUrl.substr(qin+1);
				selfUrl = selfUrl.substr(0, qin);

				// parse param string
				var pairs = urlPartParams.split("&");
				$.each(pairs, function(i,pair) {
					var parts = pair.split("=");
					params[decodeURIComponent(parts[0])] = parts.length > 1 ? decodeURIComponent(parts[1]) : null;
				});

			}

		}
		trace("Self URL: " + selfUrl);
		trace("Params");
		console.log(params);

		return {
			params: params,
			selfUrl: selfUrl
		};

	}

})();

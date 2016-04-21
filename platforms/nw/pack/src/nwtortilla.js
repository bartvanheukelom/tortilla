(function() {
	
	var trace = tortilla.trace.bind(tortilla);
	trace(tortilla.VERSION + " starting up");
	
	tortilla.sharedInit();
			
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
	
	var preInitSteps = 2;
	
	Visibility.onVisible(function() {
		if (Visibility.isSupported()) {
			Visibility.change(function(e) {
				tortilla.dispatchEvent(tortilla.EV_VISIBILITY_CHANGED, [tortilla.isVisible()]);
			});
		}
		initStepDone();
	});
	
	$(document).on(screenfull.raw.fullscreenchange, function () {
		tortilla.dispatchEvent(tortilla.EV_FULLSCREEN_CHANGED, [tortilla.isFullscreen()]);
	});
	
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
		$(document.body).append(jCanvas);
		
		var canvas = jCanvas[0];
		tortilla.canvas = canvas;

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
		
		var meter = null;
		if (gs.showFps) {
			meter = new FPSMeter();	
		}
		
		var win = $(window);
		
		var dpr;
		if (window.devicePixelRatio) dpr = window.devicePixelRatio;
		else dpr = 1;
		
		tortilla.windowToCanvas = function(x, y) {
			return new tortilla.Point(x*dpr,y*dpr);
		};
		
		function sizeCanvas() {
			
			var ww = window.innerWidth;
			var wh = window.innerHeight;
		
			var cw = ww * dpr;
			var ch = wh * dpr;
			if (canvas.width == cw && canvas.height == ch) return;
			canvas.width = cw;
			canvas.height = ch;
			trace("canvas size " + cw + "x" + ch);
			
			if (dpr != 1) {
				jCanvas.css({width: ww + "px", height: wh + "px"});
			}
			
			tortilla.dispatchEvent(tortilla.EV_RESIZED, []);
			
		}
		win.resize(sizeCanvas);
		sizeCanvas();
		
		// prevent input events
		function pd(e) {
			if (!document.hasFocus()) window.focus();
			e.preventDefault();
		}
		document.addEventListener("click", pd);
		document.addEventListener("dblclick", pd);
		document.addEventListener("mousedown", pd);
		document.addEventListener("mouseup", pd);
		
		document.addEventListener("touchcancel", pd);
		document.addEventListener("touchend", pd);
		document.addEventListener("touchenter", pd);
		document.addEventListener("touchleave", pd);
		document.addEventListener("touchmove", pd);
		document.addEventListener("touchstart", pd);
		
//		document.addEventListener("keydown", kpd);
//		document.addEventListener("keyup", kpd);
//		document.addEventListener("keypress", kpd);
		
		if (typeof(game.init) === "function")
			game.init();
		
		if (typeof(game.frame) === "function") {
			
			var minFps = gs.hasOwnProperty("minFps") ? gs.minFps : 15;
	
			var preciseTime = "performance" in window && "now" in window.performance;
			trace("Using precision timer: " + preciseTime);
			var time = preciseTime ? performance.now() : Date.now();
			function frame() {
				
				var context = tortilla.context;
//				var context = canvas.getContext(ctReal);
				
				var now = preciseTime ? performance.now() : Date.now();
				var dt = Math.max(0.0001, Math.min(1/minFps, (now-time)/1000));
				time = now;
				
				try {
					if (meter != null) meter.tick();
					game.frame(context, dt);
				} catch (e) {
					console.log("Error in frame", e);
					if (e instanceof Error && e.stack) console.error(e.stack);
					debugger;
					//if (42 < 1) alert("The end is here"); // you can place a breakpoint on this line
				}
				requestAnimationFrame(frame);
			
			}
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

(function() {
	
	var trace = tortilla.trace.bind(tortilla);
	trace(tortilla.VERSION + " starting up");
	
	tortilla.sharedInit();
	
	tortilla.windowToCanvas = function(x, y) {
		return new tortilla.Point(x*window.devicePixelRatio, y*window.devicePixelRatio);
	};
	
	tortilla.isVisible = function() {
		return !document.hidden;
	};
	
	tortilla.openUrlEjecta = function(url, message) {
		ejecta.openURL(url, message);
	};
	
	tortilla.openInputEjecta = function(title, message, callback) {
		ejecta.getText( title, message, callback );
	};
	
	tortilla.isWebGLSupported = function() {
		
		// check if it's known at all
		//if (!("WebGLRenderingContext" in window)) return false;

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
	
	document.addEventListener("visibilitychange", function() {
		tortilla.dispatchEvent(tortilla.EV_VISIBILITY_CHANGED, [tortilla.isVisible()]);
	});
	
	tortilla.ejectaInit = function() {
		
		var game = tortilla.game;

		var gs = typeof(game.settings) === "function" ? game.settings() : {};
		tortilla.namespace = gs.namespace;
		
		
		canvas.MSAAEnabled = gs.hasOwnProperty("ejectaMSAA") ? gs.ejectaMSAA : false;
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";
        tortilla.canvas = canvas;

		var context;
		var ct;
		var ctReal;
		if (gs.tryWebGL) { //&& "WebGLRenderingContext" in window) {
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
		trace("ct: " + ct);
		trace("ctReal: " + ctReal);
		tortilla.context = canvas.getContext(ctReal);
		tortilla.contextType = ct;
		
//		trace("canvas size " + canvas.width + "x" + canvas.height);
//		var cWidth = canvas.width;
//		var cHeight = canvas.height;
		
		if (typeof(game.init) === "function")
			game.init();
		
		if (typeof(game.frame) === "function") {
			
			var minFps = gs.hasOwnProperty("minFps") ? gs.minFps : 15;
			
			var time = performance.now();
			function frame() {

				// detect canvas resize
				// TODO orientation
//				if (cWidth != canvas.width || cHeight != canvas.height) {
//					trace("canvas resize " + canvas.width + "x" + canvas.height);
//					cWidth = canvas.width;
//					cHeight = canvas.height;
//					tortilla.dispatchEvent(tortilla.EV_RESIZED, []);
//				}
				
				var context = tortilla.context;
//				var context = canvas.getContext(ctReal);
			
				var now = performance.now();
				var dt = Math.max(0.0001, Math.min(1/minFps, (now-time)/1000));
				time = now;
		
				try {
					game.frame(context, dt);
				} catch (e) {
					console.log("Error in frame", e);
					if (42 < 1) alert("The end is here"); // you can place a breakpoint on this line
				}
				requestAnimationFrame(frame);
			
			}
			requestAnimationFrame(frame);
			
		}
		
	};

})();

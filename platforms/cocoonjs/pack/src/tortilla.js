"use strict";

(function() {
	
	var trace = tortilla.trace.bind(tortilla);
	trace(tortilla.VERSION + " starting up");
	
	tortilla.cocoonInit = function() {
		
		var game = tortilla.game;

		var gs = typeof(game.settings) === "function" ? game.settings() : {};
		tortilla.namespace = gs.namespace;
		
		var canvas = document.createElement("canvas");
		document.body.appendChild(canvas);
		canvas.screencanvas = true;
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
		
		function sizeCanvas() {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			trace("canvas size " + canvas.width + "x" + canvas.height);
			tortilla.dispatchEvent(tortilla.EV_RESIZED, []);
		}
		sizeCanvas();
		
		if (typeof(game.init) === "function")
			game.init();
		
		if (typeof(game.frame) === "function") {
			
			var minFps = gs.hasOwnProperty("minFps") ? gs.minFps : 15;
			
			var time = Date.now();
			var frame = function() {
			
				if (canvas.width != window.innerWidth || canvas.height != window.innerHeight) {
					sizeCanvas();
				}
				
				var context = tortilla.context;
//				var context = canvas.getContext(ctReal);
			
				var now = Date.now();
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
		
	}

})();

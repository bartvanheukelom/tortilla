
"use strict";

(function() {
	
	var MUSIC = true;

	var dots = [];
	var time = 0;
	var speed = 1;
	
	var keysDown = {};
	var touches = [];
	
	var KEY_RIGHT = 39;
	var KEY_LEFT = 37;
	var KEY_DOWN = 40;
	var KEY_UP = 38;
	
	var image = null;
	var image2 = null;
	var cross = null;
	
	function isKeyDown(code) {
		return keysDown.hasOwnProperty(code) && keysDown[code];
	}

	tortilla.game = {
		settings: function() {
			return {
				showFps: true
			};
		},

		init: function() {
		
			$("body").append("<input type='text' style='position: absolute; left: 100px; z-index: 100;'>Hoi</input>");
			
			var c = tortilla.canvas;
			
			tortilla.addEventListener(tortilla.EV_VISIBILITY_CHANGED, function(visible) {
				if (visible) Howler.unmute();
				else Howler.mute();
			});

			if (MUSIC) {
				var music = new Howl({
					urls: ["OutRun.ogg","OutRun.mp4"],
					loop: true,
					volume: 0.5,
					onload: function() {
						console.log("music loaded");
						music.play();
					}
				});
			}

			var coin = new Howl({
				urls: ["lifeup.ogg","lifeup.mp4"],
				onload: function() {
					console.log("coin loaded");
				}
			});
			
			if (tortilla.platform == "browser") {		

				var body = $(document.body);
			
				body.keydown(function(e) {
					console.log("keydown", e);
					keysDown[e.keyCode] = true;
					console.log(keysDown);
				});
				body.keyup(function(e) {
					console.log("keyup", e);
					keysDown[e.keyCode] = false;
					console.log(keysDown);
				});
				
				$(c).click(function() {
					coin.play();
				});

			}
			
			var imageLoader = new Image();
			imageLoader.onload = function() {
	          image = imageLoader;
	        };
	        imageLoader.src = "particle1.png";
	        var imageLoader2 = new Image();
			imageLoader2.onload = function() {
	          image2 = imageLoader2;
	        };
	        imageLoader2.src = "particle2.png";
			
	        if ("ontouchstart" in window) {
			
				var updateTouches = function(e) {
					touches = e.touches;
				};
			
				c.addEventListener("touchstart", function(e) {
					updateTouches(e);
					console.log("coin");
					coin.play();
				});
				c.addEventListener("touchend", updateTouches);
				c.addEventListener("touchmove", updateTouches);
				if (tortilla.platform != "cocoonjs") {
					c.addEventListener("touchenter", updateTouches);
					c.addEventListener("touchleave", updateTouches);
				}
				c.addEventListener("touchcancel", updateTouches);
				
			}
			
	        // generate a cross image
	        cross = tortilla.createBuffer(400,400);
	        var crossCtx = cross.getContext("2d");
	        var crossGrd = crossCtx.createLinearGradient(0,0,0,400);
	        crossGrd.addColorStop(0,"#ffffff");
	        crossGrd.addColorStop(0.5,"blue");
	        crossGrd.addColorStop(1,"#000000");
	        crossCtx.fillStyle = crossGrd;
	        crossCtx.fillRect(0,0,400,400);
	        crossCtx.fillStyle = "#aa0000";
	        crossCtx.fillRect(175,0,50,400);
	        crossCtx.fillRect(0,175,400,50);
	        
	        // sattelite junk
			for (var i = 0; i < 200; i++) {
				dots.push({
					distance: (Math.random()*0.3) + 0.7,
					color: "rgb(" + (Math.floor(Math.random()*256)) + "," + (Math.floor(Math.random()*256)) + "," + (Math.floor(Math.random()*256)) + ")",
					size: Math.random()*0.5 + 0.5,
					offset: Math.random() * Math.PI * 2,
					rotation: Math.random() * Math.PI * 2,
		//			speed: 0.3,
		//			offset: 0,
					speed: (Math.random()*0.99) + 0.01,
		//			speed: Math.random()*2 -1,
//					shape: Math.floor(Math.random()*2)+2,
					shape: Math.floor(Math.random()*4),
					wiggleDist: Math.random() * 0.2,
					wiggleSpeed: Math.random()
				});
			}
			
			// star
			var points = 5; // meaning 20
			for (var s = 0; s < points; s++) {
				dots.push({
					distance: 0,
					color: "rgb(255,255,255)",
					size: 8,// + Math.random()*0.5,
					offset: 0,
					rotation: (Math.PI/(points*2)) * s,
					speed: 0.05,
					shape: 1
				});
			}
		},

		frame: function(g, dt) {

			var c = tortilla.canvas;
			
			var ds = 0;
			var tchRight = false;
			var tchLeft = false;
			for (var t = 0; t < touches.length; t++) {
				var touch = touches[t];
				var p = tortilla.windowToCanvas(touch.clientX, touch.clientY);
				if (p.x > c.width/2) tchRight = true;
				else tchLeft = true;
			}
			if (isKeyDown(KEY_RIGHT) || tchRight) ds += 1;
			if (isKeyDown(KEY_LEFT) || tchLeft) ds -= 1;
			if (ds != 0) {
				if (ds > 0)
					speed *= Math.pow(2, dt);
				else
					speed /= Math.pow(2, dt);
				console.log("speed", speed);
			}
			
			var s = speed;
			if (isKeyDown(KEY_UP)) s *= 10;
			if (isKeyDown(KEY_DOWN)) s /= 10;

			time += dt * s;

			g.fillStyle = "rgb(0,0,20)";
			g.fillRect(0,0,c.width,c.height);  	
	
			g.fillStyle = "rgb(255,255,255)";
			g.fillText(
				"canvas " + c.width + "x" + c.height + "; dots " + dots.length + "; touches " + touches.length,
				10, c.height-10
			);

			g.save();
			try {
	
				var ratioGame = 1;
				var ratioCanvas = c.width / c.height;
		
				var scaleHor = ratioCanvas < ratioGame;
				if (scaleHor) {
					g.translate(0, c.height / 2);
					var scale = c.width / 1000;
					g.scale(scale, scale);
					g.translate(0, -1000 / 2);
				} else {
					g.translate(c.width / 2, 0);
					var scale = c.height / 1000;
					g.scale(scale, scale);
					g.translate(-1000 / 2, 0);
				}
		
				var p = 30;	
				g.fillStyle = "rgb(200,0,0)";  
				g.fillRect(p, p, 1000 - (p*2), 1000 - (p*2));
				
				g.fillStyle = "rgb(255,255,0)";
				g.fillText("Speed: " + s + " (right = faster, left = slower, up = boost, down = bullet-time)", 10 + p, 20 + p);
				
				// move to the middle of the block
				g.translate(500,500);
				
				for (var d = 0; d < dots.length; d++) {
					var dot = dots[d];
	
					var arc = dot.offset + (time / (0.333/dot.speed));
		//			arc += dot.wiggleDist * Math.sin((Date.now()-st) / (100*dot.wiggleSpeed));
					var spinRadius = dot.distance * 420;
					var circleRadius = dot.size * 20;
	
					var x = (Math.cos(arc) * spinRadius);
					var y = (Math.sin(arc) * spinRadius);
	
					g.save();
					try {
				
						g.translate(x,y);
						g.rotate(dot.rotation+arc);
					
						g.fillStyle = dot.color;
						if (dot.shape == 0) {
							g.beginPath();
							g.arc(
								0, 0, circleRadius,
								0, 2*Math.PI
							);
							g.closePath();
							g.fill();
						} else if (dot.shape == 1) {
				
							var wh = circleRadius*2;
							g.fillRect(
								-circleRadius, -circleRadius,
								wh, wh
							);
					
					
						} else {
							var im = dot.shape == 2 ? image : image2;
							if (im != null) {
								var s = circleRadius*2 / im.width;
								g.scale(s, s);
								g.translate(-im.width/2, -im.height/2);
								g.drawImage(im, 0, 0);
							}
						}
			
					} finally {
						g.restore();
					}
			
				}
	
				// draw cross
				g.save(); {
					g.rotate(-time);

					// double clip
					g.beginPath();
					g.arc(0,0,110,0,Math.PI*2);
					g.closePath();
					g.clip();
					
					g.beginPath();
					g.rect(-100,-100,200,200);
					g.clip();
					
					g.translate(-200,-200);
					g.drawImage(cross, 0, 0);
					
				} g.restore();
				
			} finally {
				g.restore();
			}
			
			for (var t = 0; t < touches.length; t++) {
			
				var touch = touches[t];
				
				var p = tortilla.windowToCanvas(touch.clientX, touch.clientY);
				
				g.fillStyle = "rgba(255,255,255,0.5)";
				g.beginPath();
				g.arc(
					p.x, p.y, c.width / 20, //Math.max(touch.radiusX, touch.radiusY),
					0, 2*Math.PI
				);
				g.closePath();
				g.fill();
	
			}
	
		}
	};
	
})();



"use strict";

(function() {
	
	var image = null;
	
	tortilla.game = {
		settings: function() {
			return {
				//showFps: true
			};
		},

		init: function() {
		
			var imageLoader = new Image();
			imageLoader.onload = function() {
	          image = imageLoader;
	        };
	        imageLoader.src = "particle1.png";
			
		},

		frame: function(g, dt) {
			
			var c = tortilla.canvas;

			g.fillStyle = "rgb(0,0,20)";
			g.fillRect(0,0,c.width,c.height);  	
			
			g.save(); {
			
				g.translate(Date.now() % (c.width-100), 30);
		
				g.fillStyle = "rgb(255,255,255)";
				g.fillRect(0, 0, 100, 100);
				
				if (image != null)
					g.drawImage(image, 0,0);
				
			} g.restore();
	
		}
	};
	
})();


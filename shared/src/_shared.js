"use strict";

(function() {

	var eventListeners = {};
	var showStorageWarning = true;
	
	function eventListenerList(event) {
		if (eventListeners.hasOwnProperty(event)) {
			return eventListeners[event];
		} else {
			return eventListeners[event] = {};
		}
	}
	
	function paramsToQueryString(params) {
		var parts = [];
		for (var key in params) {
			parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
		}
		return parts.join("&");
	}

	var tortilla = null;
	tortilla = {
			
		VERSION: "0.5",
			
		EV_VISIBILITY_CHANGED: "visibilityChanged",
		EV_FULLSCREEN_CHANGED: "fullscreenChanged",
		EV_RESIZED: "resized",
		
		Point: function(x,y) {
			this.x = x;
			this.y = y;
		},
		
		trace: function(x) {
			console.log("[tortilla/" + this.platform + "] " + x);
		},
		
		addEventListener: function(event, cb) {
			var l = eventListenerList(event);
			
			var key;
			do {
				key = Math.floor(Math.random() * 10000000).toString();
			} while (l.hasOwnProperty(key));
			l[key] = cb;
			
			return key;
		},
		
		removeEventListener: function(event, listener) {
			var l = eventListenerList(event);
			if (typeof listener === "string") delete l[listener];
			else {
				for (var key in l) {
					if (l[key] == listener) {
						delete l[key];
					}
				}
			}
		},
		
		dispatchEvent: function(event, args) {
			var l = eventListenerList(event);
			for (var key in l) {
				var cb = l[key];
				try {
					cb.apply(null, args);
				} catch (e) {
					console.error("Error in event listener: " + e.stack);
				}
			}
		},
		
		storagePut: function(key, value, session) {
			var v;
			switch (typeof value) {
				case "string":
				case "number":
				case "boolean":
					v = value.toString();
					break;
				case "object":
					v = JSON.stringify(value);
					break;
				default:
					throw new Error("Can't store value of type " + typeof value);
			}
			try{
				(session ? window.sessionStorage : window.localStorage).setItem(this.namespace + "." + key, v);
			} catch (e) {
				if(showStorageWarning) {
					console.log("WARNING: Unable to access storage, due to browser cookie access settings", key + " has not been saved");
					showStorageWarning = false;
				}
			}
		},
		
		storageGetString: function(key, fallback, session) {
			try {
				var k = this.namespace + "." + key;	
				var v = (session ? window.sessionStorage : window.localStorage).getItem(k);
				return v == null ? fallback : v;
			} catch (e) {
				if(showStorageWarning) {
					console.log("WARNING: Unable to access storage, due to browser cookie access settings");
					showStorageWarning = false;
				}
				return fallback;
			}
		},
		
		storageGetBoolean: function(key, fallback, session) {
			try {
				var v = this.storageGetString(key, null, session);
				return v == null ? fallback : (v == "true");			
			} catch (e) {				
				if(showStorageWarning) {
					console.log("WARNING: Unable to access storage, due to browser cookie access settings");				
					showStorageWarning = false;
				}
				return fallback;
			}
		},
		
		storageGetNumber: function(key, fallback, session) {
			try {
				var v = this.storageGetString(key, null, session);
				return v == null ? fallback : parseFloat(v);			
			} catch (e) {				
				if(showStorageWarning) {
					console.log("WARNING: Unable to access storage, due to browser cookie access settings");
					showStorageWarning = false;
				}
				return fallback;
			}
		},
		
		storageGetObject: function(key, fallback, session) {
			try {
				var v = this.storageGetString(key, null, session);
				return v == null ? fallback : JSON.parse(v);			
			} catch (e) {				
				if(showStorageWarning) {
					console.log("WARNING: Unable to access storage, due to browser cookie access settings");
					showStorageWarning = false;
				}
				return fallback;
			}
		},
		
		setCursor: function(cursor) {},
		
		createBuffer: function(width,height) {
			var buf = document.createElement("canvas");
			buf.width = width;
			buf.height = height;
			return buf;
		},
		
		fullscreenSupported: function() {
			return false;
		},
		
		isFullscreen: function() {
			return true;
		},
		
		setFullscreen: function(fs) {},
		
		windowToCanvas: function(x, y) {
			return new this.Point(x,y);
		},
		
		loadScript: function (url, done) {
			throw new Error("Cannot load external script on this platform.");
		},
		
		isVisible: function() {
			return true;
		},
		
		parameters: {
			all: {},
			
			has: function(key) {
				return this.all.hasOwnProperty(key);
			},
			
			get: function(key, fallback) {
				if (this.has(key)) return this.all[key];
				else return fallback;
			},
			
			insert: function(src, override) {
				tortilla.copyProps(src, this.all, override);
			}
		},
		
		copyProps: function(from, to, override) {
			if (typeof override === "undefined") override = true;
			for (var k in from) {
				if (override || !(k in to)) to[k] = from[k];
			}
			return to;
		},
		
		sharedInit: function() {
			this.parameters.insert(this.BUILD_PARAMETERS);
		},
		
		reload: function(withParams) {
			if (typeof withParams == "undefined") {
				location.reload();
			} else {
				var hasParams = location.href.indexOf("?") != -1 || location.href.indexOf("?") != -1; // TODO this isn't really nice
				location.href = location.href + (hasParams ? "" : "?") + paramsToQueryString(withParams);
			}
		}
		
	};
	
	// export tortilla
	window.tortilla = tortilla;
	
})();

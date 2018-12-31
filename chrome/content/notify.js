var hcNotify = {
	_transition: null,
	showHideDuration: 200,

	startColor: 0, // >= 0 (black)
	endColor: 255, // <= 255 (white)
	hoverColor: "blue", // valid color string

	inWindowCorner: false,
	_closeTimeout: 0,
	_highlightInterval: 0,

	init: function() {
		var opts = window.arguments[0];
		// Properties:
		// closeDelay, title, message, onLeftClick, onMiddleClick, icon,
		// inWindowCorner, dontCloseUnderCursor, rearrangeWindows
		document.getElementById("hcNotifyHeader").textContent = opts.title + "\n\n";
		var descElt = document.getElementById("hcNotifyDesc");
		descElt.textContent = opts.message;
		var s = descElt.style;
		s.maxWidth  = Math.round(screen.availWidth *0.6) + "px";
		s.maxHeight = Math.round(screen.availHeight*0.6) + "px";
		var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
			.getService(Components.interfaces.nsIXULAppInfo);
		s.whiteSpace = appInfo.name == "Firefox" && parseFloat(appInfo.version) < 3
			? "-moz-pre-wrap"
			: "pre-wrap";
		document.getElementById("hcNotifyImg").setAttribute("hc_icon", opts.icon);
		window.sizeToContent();
		var winW = window.outerWidth, winH = window.outerHeight;
		var maxW = Math.round(screen.availWidth*0.65) + 100;
		if(winW > maxW) {
			winW = maxW;
			window.resizeTo(winW, winH);
		}
		var wo = opts.parentWindow || window.opener;
		var x, y;
		if(wo.closed) {
			x = screen.availLeft + screen.availWidth - winW;
			y = screen.availTop + screen.availHeight - winH;
		}
		else if(opts.inWindowCorner || !("handyClicks" in wo) || !wo.handyClicks._xy) { // Show in window corner
			this.inWindowCorner = true;
			x = wo.screenX + wo.outerWidth - winW;
			var wod = wo.document;
			var sBar = wod.getElementById("browser-bottombox")
				|| wod.getElementById("status-bar")
				|| wod.getAnonymousElementByAttribute(wod.documentElement, "anonid", "buttons")
				|| wod.getAnonymousElementByAttribute(wod.documentElement, "anonid", "dlg-buttons");
			y = (sBar ? sBar.boxObject.screenY : wo.screenY + wo.outerHeight) - winH;
		}
		else { // Show under cursor
			var cursorH = 20, addH = 8;
			var maxX = screen.availLeft + screen.availWidth;
			var maxY = screen.availTop + screen.availHeight;
			var xy = wo.handyClicks._xy;
			x = xy.screenX - winW/2;
			y = xy.screenY + cursorH + addH;
			if(x < screen.availLeft) // left overflow
				x = screen.availLeft;
			else if(x + winW > maxX) // right overflow
				x = maxX - winW;
			if(y + winH > maxY) // bottom overflow
				y = xy.screenY - winH - addH;
		}
		window.moveTo(x, y);

		if(this.inWindowCorner && opts.rearrangeWindows) {
			var ws = this.ws;
			while(ws.hasMoreElements()) {
				var w = ws.getNext();
				if(w == window || w.hcNotify && !w.hcNotify.inWindowCorner)
					continue;
				var dh = -(winH + 2);
				if(w.screenY + dh >= 0)
					w.moveBy(0, -(winH + 2));
			}
		}

		var notifyBox = this._notifyBox = document.getElementById("hcNotifyBox");
		if(typeof opts.onLeftClick == "function")
			notifyBox.className += " hc-clickable";

		this._closeDelay = opts.closeDelay;
		var s = notifyBox.style;
		var transition = this._transition = "transition" in s && "transition"
			|| "MozTransition" in s && "MozTransition";
		if(transition) {
			this._closeDelay = Math.max(0, this._closeDelay - this.showHideDuration);
			s.opacity = 0;
			setTimeout(function(_this) {
				s[transition] = "opacity " + _this.showHideDuration + "ms ease-in-out";
				s.opacity = 1;
			}, 0, this);
		}

		//~ todo: rewrite using CSS transitions
		this._colorDelta = this.endColor - this.startColor;
		this.delayedClose();
		if(opts.dontCloseUnderCursor)
			this.initDontClose();
	},
	initDontClose: function() {
		var _this = this;
		window.onmouseover = window.onmouseout = function(e) {
			_this.mouseHandler(e);
		};
		window.onmouseup = function(e) {
			// mousedown and "drag" anything outside the window
			// -> mouseout from window => delayedClose()
			// -> move mouse => wrong mouseover => cancelDelayedClose()
			if(e.target == document)
				_this.delayedClose();
		};
	},
	destroy: function() {
		clearTimeout(this._closeTimeout);
		clearInterval(this._highlightInterval);
	},
	get ws() {
		return Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator)
			.getEnumerator(document.documentElement.getAttribute("windowtype"));
	},
	set borderColor(clr) {
		this._notifyBox.style.borderColor = clr;
	},
	numToColor: function(n) { // 0 <= n <= 255
		var h = n.toString(16);
		if(h.length == 1)
			h = "0" + h;
		return "#" + h + h + h;
	},
	setColor: function() {
		var persent = (Date.now() - this._startTime)/this._closeDelay;
		if(persent >= 1) {
			clearInterval(this._highlightInterval);
			return;
		}
		this.borderColor = this.numToColor(this.startColor + Math.round(this._colorDelta*persent));
	},
	delayedClose: function() {
		if(!this._transition)
			this._closeTimeout = setTimeout(window.close, this._closeDelay);
		else {
			this._closeTimeout = setTimeout(function(_this) {
				_this._notifyBox.style.opacity = 0;
				_this._closeTimeout = setTimeout(window.close, _this.showHideDuration);
			}, this._closeDelay, this);
		}
		this._startTime = Date.now();
		var _this = this;
		this._highlightInterval = setInterval(
			function() {
				_this.setColor();
			},
			Math.round(this._closeDelay/this._colorDelta) + 4
		);
		this.borderColor = this.numToColor(this.startColor);
	},
	cancelDelayedClose: function() {
		clearTimeout(this._closeTimeout);
		clearInterval(this._highlightInterval);
		this.borderColor = this.hoverColor;
		if(this._transition)
			this._notifyBox.style.opacity = 1;
	},
	mouseHandler: function(e) {
		if(!e.relatedTarget)
			this[e.type == "mouseover" ? "cancelDelayedClose" : "delayedClose"]();
	},
	clickHandler: function(e) {
		this.cancelDelayedClose();
		var opts = window.arguments[0];
		var hasModifier = e.ctrlKey || e.shiftKey || e.altKey || e.metaKey;

		if(e.button == 2 && hasModifier) {
			var ws = this.ws;
			while(ws.hasMoreElements())
				ws.getNext().close();
		}
		else
			window.close();

		if(
			e.button == 0 && !hasModifier
			&& typeof opts.onLeftClick == "function"
		)
			opts.onLeftClick.call(opts.context || window.opener);
		else if(
			(e.button == 1 || e.button == 0 && hasModifier)
			&& typeof opts.onMiddleClick == "function"
		)
			opts.onMiddleClick.call(opts.context || window.opener);
	}
};
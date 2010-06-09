var hcNotify = {
	startColor: 0, // >= 0 (black)
	endColor: 255, // <= 255 (white)
	hoverColor: "blue", // valid color string

	_closeTimeout: null,
	_highlightInterval: null,

	init: function() {
		var wa = window.arguments[0];
		// { dur, header, msg, funcLeftClick, funcMiddleClick, icon, inWindowCorner, dontCloseUnderCursor }
		document.getElementById("hcNotifyHeader").textContent = wa.header + "\n\n";
		var descElt = document.getElementById("hcNotifyDesc");
		descElt.textContent = wa.msg;
		with(descElt.style) {
			maxWidth  = Math.round(screen.availWidth *0.6) + "px";
			maxHeight = Math.round(screen.availHeight*0.6) + "px";
			var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
				.getService(Components.interfaces.nsIXULAppInfo);
			whiteSpace = appInfo.name == "Firefox" && parseFloat(appInfo.version) < 3
				? "-moz-pre-wrap"
				: "pre-wrap";
		}
		document.getElementById("hcNotifyImg").setAttribute("hc_icon", wa.icon);
		window.sizeToContent();
		var winW = window.outerWidth, winH = window.outerHeight;
		var maxW = Math.round(screen.availWidth*0.65) + 100;
		if(winW > maxW) {
			winW = maxW;
			window.resizeTo(winW, winH);
		}
		var wo = window.opener;
		var x, y;
		if(wa.inWindowCorner || !("handyClicks" in wo) || !wo.handyClicks._xy) { // Show in window corner
			x = wo.screenX + wo.outerWidth - winW;
			var sBar = wo.document.getElementById("browser-bottombox") || wo.document.getElementById("status-bar");
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
		this._notifyBox = document.getElementById("hcNotifyBox");
		this._colorDelta = this.endColor - this.startColor;
		this._dur = wa.dur;
		this.delayedClose();
		if(wa.dontCloseUnderCursor)
			this.initDontClose();
	},
	initDontClose: function() {
		var _this = this;
		window.onmouseover = window.onmouseout = function(e) {
			_this.mouseHandler(e);
		};
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
		var persent = (Date.now() - this._startTime)/this._dur;
		if(persent >= 1) {
			clearInterval(this._highlightInterval);
			return;
		}
		this.borderColor = this.numToColor(this.startColor + Math.round(this._colorDelta*persent));
	},
	delayedClose: function() {
		this._closeTimeout = setTimeout(window.close, this._dur);
		this._startTime = Date.now();
		var _this = this;
		this._highlightInterval = setInterval(
			function() {
				_this.setColor();
			},
			Math.round(this._dur/this._colorDelta) + 4
		);
		this.borderColor = this.numToColor(this.startColor);
	},
	cancelDelayedClose: function() {
		clearTimeout(this._closeTimeout);
		clearInterval(this._highlightInterval);
		this.borderColor = this.hoverColor;
	},
	mouseHandler: function(e) {
		if(!e.relatedTarget)
			this[e.type == "mouseover" ? "cancelDelayedClose" : "delayedClose"]();
	},
	clickHandler: function(e) {
		this.cancelDelayedClose();
		var wa = window.arguments[0];
		if(
			e.button == 0 && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey
			&& typeof wa.funcLeftClick == "function"
		)
			wa.funcLeftClick();
		else if(
			(e.button == 1 || (e.button == 0 && (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey)))
			&& typeof wa.funcMiddleClick == "function"
		)
			wa.funcMiddleClick();
		window.close();
	}
};
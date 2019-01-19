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
		var opts = this.opts = window.arguments[0];
		// Properties:
		// closeDelay, title, message, onLeftClick, onMiddleClick, icon,
		// inWindowCorner, dontCloseUnderCursor, rearrangeWindows
		document.getElementById("hcNotifyHeader").textContent = opts.title + "\n";
		var descElt = document.getElementById("hcNotifyDesc");
		descElt.textContent = opts.message;
		document.getElementById("hcNotifyImg").setAttribute("hc_icon", opts.icon);
		var closeBtn = document.getElementById("hcNotifyClose");
		if(getComputedStyle(closeBtn, null).listStyleImage == "none") {
			closeBtn.className += " tabs-closebutton";
			document.loadOverlay("data:application/vnd.mozilla.xul+xml," + encodeURIComponent(
				'<?xml version="1.0"?>'
				+ '\n<?xml-stylesheet href="chrome://browser/skin/browser.css" type="text/css"?>'
				+ '\n<overlay xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" />'
			), null);
		}

		var buttons = opts.buttons || false;
		if(buttons) {
			var localized = opts.localized || {};
			var btnBox = document.getElementById("hcNotifyButtons");
			for(var label in buttons) if(buttons.hasOwnProperty(label)) {
				var btn = document.createElement("button");
				btn._command = buttons[label];
				label = localized[label] || label;
				if(/(^|[^&])&([^&])/.test(label)) {
					label = RegExp.leftContext + RegExp.$1 + RegExp.$2 + RegExp.rightContext;
					btn.setAttribute("accesskey", RegExp.$2);
				}
				btn.setAttribute("label", label);
				btn.setAttribute("oncommand", "hcNotify.doCommand(this._command);");
				btnBox.appendChild(btn);
			}
		}

		var maxW = opts.messageMaxWidth  || 480;
		var maxH = opts.messageMaxHeight || 240;
		var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
			.getService(Components.interfaces.nsIXULAppInfo);
		var ds = descElt.style;
		ds.whiteSpace = appInfo.name == "Firefox" && parseFloat(appInfo.version) < 3
			? "-moz-pre-wrap"
			: "pre-wrap";
		ds.wordWrap = "break-word";
		var obs = document.getElementById("hcNotifyOverflowBox").style;
		if(descElt.scrollWidth > maxW)
			obs.width = obs.maxWidth = maxW + "px";
		if(descElt.scrollWidth > maxW) // Still not fit? Will force apply "break-word"
			ds.width = maxW + "px";
		if(descElt.scrollHeight > maxH)
			obs.height = obs.maxHeight = maxH + "px";
		else
			obs.height = descElt.scrollHeight + "px";

		window.sizeToContent();
		var winW = window.outerWidth, winH = window.outerHeight;
		var wo = opts.parentWindow || window.opener;
		var x, y;
		var maxX = screen.availLeft + screen.availWidth;
		var maxY = screen.availTop + screen.availHeight;
		if(wo.closed) {
			x = maxX - winW;
			y = maxY - winH;
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
			var xy = wo.handyClicks._xy;
			x = xy.screenX - winW/2;
			y = xy.screenY + cursorH + addH;
		}
		if(x < screen.availLeft) // left overflow
			x = screen.availLeft;
		else if(x + winW > maxX) // right overflow
			x = maxX - winW;
		if(y < screen.availTop) // top overflow
			y = screen.availTop;
		else if(y + winH > maxY) // bottom overflow
			y = maxY - winH;
		window.moveTo(x, y);

		if(this.inWindowCorner && opts.rearrangeWindows) {
			var ws = this.ws;
			while(ws.hasMoreElements()) {
				var w = ws.getNext();
				if(w == window || w.hcNotify && !w.hcNotify.inWindowCorner)
					continue;
				var dh = -(winH + 2);
				if(w.screenY + dh >= screen.availTop)
					w.moveBy(0, dh);
			}
		}

		var notifyBox = this._notifyBox = document.getElementById("hcNotifyBox");
		if(typeof opts.onLeftClick == "function")
			notifyBox.className = "hc-clickable";

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
		this.resetTimers();
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
		if(n < 16)
			h = "0" + h;
		return "#" + h + h + h;
	},
	setColor: function() {
		var persent = (Date.now() - this._startTime)/this._closeDelay;
		if(persent > 1) {
			clearInterval(this._highlightInterval);
			this._highlightInterval = 0;
			return;
		}
		this.borderColor = this.numToColor(this.startColor + Math.round(this._colorDelta*persent));
	},
	delayedClose: function() {
		this.resetTimers();
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
		this.resetTimers();
		this.borderColor = this.hoverColor;
		if(this._transition)
			this._notifyBox.style.opacity = 1;
	},
	resetTimers: function() {
		if(this._closeTimeout) {
			clearTimeout(this._closeTimeout);
			this._closeTimeout = 0;
		}
		if(this._highlightInterval) {
			clearInterval(this._highlightInterval);
			this._highlightInterval = 0;
		}
	},
	hasModifier: function(e) {
		return e.ctrlKey || e.shiftKey || e.altKey || e.metaKey;
	},
	mouseHandler: function(e) {
		if(!e.relatedTarget)
			this[e.type == "mouseover" ? "cancelDelayedClose" : "delayedClose"]();
	},
	clickHandler: function(e) {
		this.cancelDelayedClose();
		var opts = this.opts;
		var hasModifier = this.hasModifier(e);
		if(
			e.button == 0 && !hasModifier
			&& typeof opts.onLeftClick == "function"
			&& getSelection().isCollapsed
		)
			this.doCommand(opts.onLeftClick);
		else if(
			(e.button == 1 || e.button == 0 && hasModifier)
			&& typeof opts.onMiddleClick == "function"
		)
			this.doCommand(opts.onMiddleClick);
	},
	doCommand: function(cmd) {
		window.close();
		cmd && cmd.call(this.opts.context || window.opener);
	},
	close: function(e) {
		if(e.button > 0 || this.hasModifier(e))
			this.closeAll();
		else
			window.close();
	},
	closeAll: function() {
		var ws = this.ws;
		while(ws.hasMoreElements())
			ws.getNext().close();
	},
	copyAll: function() {
		var msg = document.getElementById("hcNotifyBox").textContent;
		var buttons = Array.prototype.map.call(
			document.getElementById("hcNotifyButtons").childNodes,
			function(btn) {
				return btn.getAttribute("label");
			}
		).join("   ");
		this.copy(msg + (buttons ? "\n" + buttons : ""));
	},
	copy: function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyStringToClipboard(
				str,
				Components.interfaces.nsIClipboard.kGlobalClipboard,
				document
			);
	}
};
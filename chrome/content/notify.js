var hcNotify = {
	showHideDuration: 200,

	startColor: 0, // >= 0 (black)
	endColor: 255, // <= 255 (white)
	hoverColor: "%hover",
	blinkColor: "%blink",

	inWindowCorner: false,
	parentWindow: null,
	_closeTimer: 0,
	_highlightTimer: 0,
	_blinkTimer: 0,

	init: function() {
		var opts = this.opts = window.arguments[0]; // See utils.js -> notify: function(...
		var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
			.getService(Components.interfaces.nsIXULAppInfo);
		this.$("hcNotifyHeader").textContent = opts.title + "\n";
		var descElt = this.$("hcNotifyDesc");
		descElt.textContent = opts.message;
		this.$("hcNotifyImg").setAttribute("hc_icon", opts.icon);
		var closeBtn = this.$("hcNotifyClose");
		if(getComputedStyle(closeBtn, null).listStyleImage == "none") {
			var isSeaMonkey = appInfo.name == "SeaMonkey";
			closeBtn.className += isSeaMonkey ? " findbar-closebutton" : " tabs-closebutton";
			var css = isSeaMonkey ? "chrome://global/skin/findBar.css" : "chrome://browser/skin/browser.css";
			document.loadOverlay("data:application/vnd.mozilla.xul+xml," + encodeURIComponent(
				'<?xml version="1.0"?>'
				+ '\n<?xml-stylesheet href="' + css + '" type="text/css"?>'
				+ '\n<overlay xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" />'
			), null);
		}

		var buttons = opts.buttons || false;
		if(buttons) {
			var localized = opts.localized || {};
			var btnBox = this.$("hcNotifyButtons");
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
		var ds = descElt.style;
		ds.whiteSpace = appInfo.name == "Firefox" && parseFloat(appInfo.version) < 3
			? "-moz-pre-wrap"
			: "pre-wrap";
		ds.wordWrap = "break-word";
		var obs = this.$("hcNotifyOverflowBox").style;
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
		var wo = this.parentWindow = opts.parentWindow || window.opener;
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
				if(
					w == window
					|| !w.hcNotify
					|| !w.hcNotify.inWindowCorner
					|| w.hcNotify.parentWindow != this.parentWindow
				)
					continue;
				var dh = -(winH + 2);
				if(w.screenY + dh >= screen.availTop)
					w.moveBy(0, dh);
			}
		}

		var box = this.box = this.$("hcNotifyBox");
		if(typeof opts.onLeftClick == "function")
			box.className = "hc-clickable";

		this.closeDelay = opts.closeDelay;
		var s = this.boxStyle = box.style;
		var transition = this.transition = "transition" in s && "transition"
			|| "MozTransition" in s && "MozTransition";
		if(!transition)
			this.colorDelta = this.endColor - this.startColor;
		else {
			this.baseTransition = "opacity " + this.showHideDuration + "ms ease-in-out";
			this.closeDelay = Math.max(0, this.closeDelay - this.showHideDuration);
			s.opacity = 0;
			box.scrollHeight; // Force reflow
			setTimeout(function(_this) {
				s[transition] = _this.baseTransition;
				s.opacity = 1;
			}, 0, this);
		}

		this.delayedClose();
		if(opts.dontCloseUnderCursor)
			this.initDontClose();
		this.updateMenus();
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
		this.updateMenus();
	},
	get ws() {
		return Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator)
			.getEnumerator(document.documentElement.getAttribute("windowtype"));
	},
	set borderColor(clr) {
		var box = this.box;
		if(clr == this.hoverColor)
			box.setAttribute("hc_state", "hover");
		else if(clr == this.blinkColor)
			box.setAttribute("hc_state", "blink");
		else {
			if(box.hasAttribute("hc_state"))
				box.removeAttribute("hc_state");
			box.style.borderColor = clr;
		}
	},
	numToColor: function(n) { // 0 <= n <= 255
		var h = n.toString(16);
		if(n < 16)
			h = "0" + h;
		return "#" + h + h + h;
	},
	delayedClose: function() {
		this.resetTimers();

		if(!this.transition) {
			this._closeTimer = setTimeout(window.close, this.closeDelay);
			this._startTime = Date.now();
			var setColor = function() {
				var persent = (Date.now() - this._startTime)/this.closeDelay;
				if(persent > 1) {
					clearInterval(this._highlightTimer);
					this._highlightTimer = 0;
					return;
				}
				this.borderColor = this.numToColor(this.startColor + Math.round(this.colorDelta*persent));
			};
			this._highlightTimer = setInterval(function(_this) {
				setColor.call(_this);
			}, Math.round(this.closeDelay/this.colorDelta) + 4, this);
			this.borderColor = this.numToColor(this.startColor);
			return;
		}

		this._closeTimer = setTimeout(function(_this) {
			_this.boxStyle.opacity = 0;
			_this._closeTimer = setTimeout(window.close, _this.showHideDuration);
		}, this.closeDelay, this);

		this.boxStyle[this.transition] = this.baseTransition;
		this.box.removeAttribute("hc_state");
		this.box.scrollHeight; // Force reflow

		setTimeout(function() {
			this.boxStyle[this.transition] = this.baseTransition
				+ ", border-color " + this.opts.closeDelay + "ms linear";
			this.box.setAttribute("hc_state", "end");
		}.bind(this), 0);
	},
	blink: function() {
		this.resetTimers();
		this.boxStyle.opacity = 1;
		var cnt = 3, _this = this;
		(function blink() {
			var hl = cnt & 1;
			if(!_this.transition)
				_this.borderColor = hl ? _this.blinkColor : _this.numToColor(_this.startColor);
			else {
				_this.boxStyle[_this.transition] = _this.baseTransition;
				_this.box.setAttribute("hc_state", hl ? "blink" : "start");
			}
			if(cnt--)
				_this._blinkTimer = setTimeout(blink, hl ? 120 : 50);
			else
				_this.delayedClose();
		})();
	},
	cancelDelayedClose: function() {
		this.resetTimers();
		if(!this.transition)
			this.borderColor = this.hoverColor;
		else {
			this.boxStyle.opacity = 1;
			this.boxStyle[this.transition] = this.baseTransition;
			this.box.setAttribute("hc_state", "hover");
		}
	},
	resetTimers: function() {
		if(this._closeTimer) {
			clearTimeout(this._closeTimer);
			this._closeTimer = 0;
		}
		if(this._highlightTimer) {
			clearInterval(this._highlightTimer);
			this._highlightTimer = 0;
		}
		if(this._blinkTimer) {
			clearTimeout(this._blinkTimer);
			this._blinkTimer = 0;
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
		else if(e.button == 1 && opts.middleClickToClose)
			window.close();
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
	initMenu: function() {
		this.$("hcNotifyMenuCopy").setAttribute("disabled", getSelection().isCollapsed);
		this.$("hcNotifyMenuCloseAll").setAttribute("disabled", !this.canCloseAll);
	},
	updateMenus: function() {
		var ws = this.ws;
		while(ws.hasMoreElements()) {
			var w = ws.getNext();
			if(w != window)
				w.hcNotify && w.hcNotify.initMenu();
		}
	},
	get canCloseAll() {
		var ws = this.ws;
		while(ws.hasMoreElements())
			if(ws.getNext() != window)
				return true;
		return false;
	},
	closeAll: function() {
		var ws = this.ws;
		while(ws.hasMoreElements())
			ws.getNext().close();
	},
	copyAll: function() {
		var msg = this.$("hcNotifyBox").textContent;
		var buttons = Array.prototype.map.call(
			this.$("hcNotifyButtons").childNodes,
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
	},
	$: function(id) {
		return document.getElementById(id);
	}
};
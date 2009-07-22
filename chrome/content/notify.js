var hcNotify = {
	startColor: 0, // >= 0 (black)
	endColor: 255, // <= 255 (white)
	_colorDelta: null,
	_startTime: null,
	_dur: null,
	_closeTimeout: null,
	_highlightInterval: null,
	_nBox: null,
	init: function() {
		var wa = window.arguments[0]; // { dur, nTitle, msg, fnc, extEnabled, inWindowCorner }
		document.getElementById("hcNotifyHeader").value = wa.nTitle;
		var descElt = document.getElementById("hcNotifyDesc");
		descElt.textContent = wa.msg;
		var maxW = Math.round(screen.availWidth*0.6);
		descElt.style.maxWidth = maxW + "px";
		if(!wa.extEnabled)
			document.getElementById("hcNotifyImg").style.marginLeft = "-24px";
		window.sizeToContent();
		var winW = window.outerWidth, winH = window.outerHeight;
		var maxW = Math.round(screen.availWidth*0.65);
		maxW += 100;
		if(winW > maxW) {
			winW = maxW;
			window.resizeTo(winW, winH);
		}
		var wo = window.opener;
		var x, y;
		if(wa.inWindowCorner || !("handyClicks" in wo) || !wo.handyClicks.copyOfEvent) {
			x = wo.screenX + wo.outerWidth - winW;
			var sBar = wo.document.getElementById("browser-bottombox") || wo.document.getElementById("status-bar");
			y = (sBar ? sBar.boxObject.screenY : wo.screenY + wo.outerHeight) - winH;
		}
		else {
			var cursorH = 20, addH = 5;
			var maxX = screen.availLeft + screen.availWidth;
			var maxY = screen.availTop + screen.availHeight;
			var evt = wo.handyClicks.copyOfEvent;
			x = evt.screenX - winW/2;
			y = evt.screenY + cursorH + addH;
			if(x < screen.availLeft) // left overflow
				x = screen.availLeft;
			else if(x + winW > maxX) // right overflow
				x = maxX - winW;
			if(y + winH > maxY) // bottom overflow
				y = evt.screenY - winH - addH;
		}
		window.moveTo(x, y);
		this._nBox = document.getElementById("hcNotifyBox");
		this._colorDelta = this.endColor - this.startColor;
		this._dur = wa.dur;
		this.delayedClose();
	},
	setColor: function() {
		var persent = (Date.now() - this._startTime)/this._dur;
		if(persent > 1) {
			clearInterval(this._highlightInterval);
			return;
		}
		var c = this.startColor + Math.round(this._colorDelta*persent);
		var h = Number(c).toString(16);
		if(h.length == 1)
			h = "0" + h;
		h = "#" + h + h + h;
		// setTimeout(function() { throw c + " >> " + h; }, 0);
		this._nBox.style.borderColor = h;
	},
	delayedClose: function() {
		this._closeTimeout = setTimeout(window.close, this._dur);

		this._startTime = Date.now();

		var _this = this;
		this._highlightInterval = setInterval(
			function() { _this.setColor(); },
			Math.round(this._dur/this._colorDelta) + 4
		);
		this._nBox.style.borderColor = "black";
	},
	cancelDelayedClose: function() {
		clearTimeout(this._closeTimeout);
		clearInterval(this._highlightInterval);
		this._nBox.style.borderColor = "blue";
	},
	mouseHandler: function(e) {
		if(!e.relatedTarget)
			this[e.type == "mouseover" ? "cancelDelayedClose" : "delayedClose"]();
	},
	clickHandler: function(e) {
		this.cancelDelayedClose();
		var fnc = window.arguments[0].fnc;
		if(typeof fnc == "function" && e.button == 0)
			fnc();
			// Strange behavior on
			// <a onclick="alert(0);" href="javascript: void(0);">...</a>
		window.close();
	}
};
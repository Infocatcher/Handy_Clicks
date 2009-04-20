var hcNotify = {
	closeTimeout: null,
	init: function() {
		var wa = window.arguments[0]; // { dur, nTitle, msg, fnc, extEnabled, inWindowCorner }
		document.getElementById("hcNotifyHeader").value = wa.nTitle;
		var descElt = document.getElementById("hcNotifyDesc");
		descElt.textContent = wa.msg;
		var maxW = Math.round(screen.availWidth*0.6);
		descElt.style.maxWidth = maxW + "px";
		document.getElementById("hcNotifyImg").style["margin" + (wa.extEnabled ? "Right" : "Left")] = "-24px";
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
		if(wa.inWindowCorner || !wo.handyClicks) {
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
		var nBox = document.getElementById("hcNotifyBox");
		setTimeout( function() { nBox.style.borderColor = "blue"; }, 150);
		setTimeout( function() { nBox.style.borderColor = "black"; }, 300);
		this.closeTimeout = setTimeout(window.close, wa.dur);
	},
	click: function(e) {
		clearTimeout(this.closeTimeout);
		var fnc = window.arguments[0].fnc;
		if(typeof fnc == "function" && e.button == 0)
			fnc();
			// Strange behavior on
			// <a onclick="alert(0);" href="javascript: void(0);">...</a>
		window.close();
	}
};
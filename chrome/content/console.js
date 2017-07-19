var handyClicksConsole = {
	__proto__: handyClicksGlobals,

	init: function(reloadFlag) {
		window.addEventListener("click", this, true);
	},
	destroy: function(reloadFlag) {
		window.removeEventListener("click", this, true);
	},
	clickHandler: function(e) {
		if(e.button != 0)
			return;
		var trg = e.originalTarget;
		var ns = trg.namespaceURI;
		var href, line;
		if( // Error Console, Browser Console
			ns == "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
			&& /(?:^|\s)text-link(?:\s|$)/.test(trg.className)
		) {
			var link = /(?:^|\s)webconsole-location(?:\s|$)/.test(trg.className)
				? trg
				: trg.parentNode;
			var href = link.getAttribute("href")
				|| link.getAttribute("title")
				|| "";
			var line = link.getAttribute("line")
				|| /:(\d+)$/.test(link.getAttribute("value")) && RegExp.$1;
		}
		else if(ns == "http://www.w3.org/1999/xhtml") { // Browser Console in Firefox 27+
			var maxDeep = 3;
			for(var a = trg; a; a = a.parentNode) {
				if(a.localName == "a") {
					if(/(?:^|\s)(?:(?:message-)?location|frame-link-source)(?:\s|$)/.test(a.className)) {
						var href = a.href;
						var line = a.sourceLine
							|| /:(\d+)$/.test(a.textContent) && RegExp.$1;
					}
					break;
				}
				if(--maxDeep <= 0)
					break;
			}
		}
		if(href && line && this.wu.openEditorLink(href, +line)) {
			e.preventDefault();
			e.stopPropagation();
		}
	},
	handleEvent: function(e) {
		if(e.type == "click")
			this.clickHandler(e);
	}
};
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
		else if( // Browser Console in Firefox 27+
			ns == "http://www.w3.org/1999/xhtml"
			&& trg.localName == "a"
			&& /(?:^|\s)location(?:\s|$)/.test(trg.className)
		) {
			var href = trg.href;
			var line = trg.sourceLine
				|| /:(\d+)$/.test(trg.textContent) && RegExp.$1;
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
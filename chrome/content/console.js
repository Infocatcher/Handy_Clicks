var handyClicksConsole = {
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
		if(!/(?:^|\s)text-link(?:\s|$)/.test(trg.className))
			return;
		var link = /(?:^|\s)webconsole-location(?:\s|$)/.test(trg.className)
			? trg
			: trg.parentNode;
		var href = link.getAttribute("href")
			|| link.getAttribute("title")
			|| "";
		var line = link.getAttribute("line")
			|| /:(\d+)$/.test(link.getAttribute("value")) && RegExp.$1;
		if(!this.wu.openEditorLink(href, +line))
			return;
		e.preventDefault();
		e.stopPropagation();
	},
	handleEvent: function(e) {
		if(e.type == "click")
			this.clickHandler(e);
	}
};
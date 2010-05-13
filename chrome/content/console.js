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
		var tar = e.originalTarget;
		if(!/(?:^|\s)text-link(?:\s|$)/.test(tar.className))
			return;
		var link = tar.parentNode;
		var href = link.getAttribute("href") || "";
		var line = Number(link.getAttribute("line"));
		if(href.indexOf(this.ct.PROTOCOL_EDITOR) == 0) {
			e.preventDefault();
			e.stopPropagation();
			this.wu.openEditorLink(href, line)
		}
	},
	handleEvent: function(e) {
		if(e.type == "click")
			this.clickHandler(e);
	}
};
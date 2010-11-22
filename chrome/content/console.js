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
		if(!this.wu.openEditorLink(href, line))
			return;
		e.preventDefault();
		e.stopPropagation();
	},
	handleEvent: function(e) {
		if(e.type == "click")
			this.clickHandler(e);
	}
};
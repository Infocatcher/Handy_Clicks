var handyClicksConsole = {
	init: function() {
		window.addEventListener("click", this, true);
	},
	destroy: function() {
		window.removeEventListener("click", this, true);
	},
	clickHandler: function(e) {
		if(e.button != 0)
			return;
		var tar = e.originalTarget;
		if(tar.className != "text-link")
			return;
		var link = tar.parentNode;
		var href = link.getAttribute("href");
		var line = parseInt(link.getAttribute("line"));
		if(!this.wu.openLink(href, line))
			return;
		e.preventDefault();
		e.stopPropagation();
	},
	handleEvent: function(e) {
		if(e.type == "click")
			this.clickHandler(e);
	}
};
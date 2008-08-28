var totalClicks = {
	disabledBy: {
		global: false,
		mousemove: false,
		cMenu: false
	},
	event: null, // ???
	origItem: null,
	item: null,
	itemType: undefined,
	forceHideCMenu: false,
	_cMenu: null,
	cMenuTimeout: null,
	strOnMousedown: "",
	init: function() {
		window.removeEventListener("load", this, false);

		// this.loadSettings();
		window.addEventListener("mousedown", this, true);
		window.addEventListener("click", this, true);
	},
	destroy: function() {
		window.removeEventListener("unload", this, false);

		window.removeEventListener("mousedown", this, true);
		window.removeEventListener("click", this, true);
	},
	get disabled() {
		for(var p in this.disabledBy)
			if(this.disabledBy[p])
				return true;
		return false;
	},
	skipTmpDisabled: function() {
		for(var p in this.disabledBy)
			if(P != "global")
				this.disabledBy[p] = false;
	},
	get cMenu() {
		var cm = null;
		switch(this.itemType) {
			case "link":
				cm = document.getElementById("contentAreaContextMenu");
			break;
			//~ todo
			// ...
		}
		this._cMenu = cm; // cache
		return cm;
	},
	mousedownHandler: function(e) {
		/*
		var evtStr = this.getEvtStr(e);
		this.strOnMousedown = evtStr;
		var sets = this.getSettings(evtStr);
		if(!sets)
			return;
		this.defineItem(e, sets);

		var funcObj = this.getFuncObj(sets);
		if(!funcObj)
			return;
		*/

		this.defineItem(e);
		if(!this.itemType)
			return;

		var cm = this.cMenu;
		var _this = this;
		if(cm && e.button == 2) {
			//~ todo: show menu after timeout
			cm.addEventListener(
				"popupshowing",
				function(e) {
					_this.disabledBy.cMenu = true;
					window.removeEventListener(e.type, arguments.callee, true);
				},
				true
			);
		}
		window.addEventListener( // only for right-click?
			"mousemove",
			function(e) {
				_this.disabledBy.mousemove = true;
				_this.clearCMenuTimeout();
				window.removeEventListener(e.type, arguments.callee, true);
			},
			true
		);
	},
	getEvtStr: function(e) {
		return "button=" + e.button
			+ ",ctrl=" + e.ctrlKey
			+ ",shift=" + e.shiftKey
			+ ",alt=" + e.altKey
			+ ",meta=" + e.metaKey;
	},
	getSettings: function(str) {
		return (totalClicksPrefs || {})[str];
	},
	defineItem: function(e, sets) {
		this.event = e;
		this.itemType = undefined; // "link", "img", "bookmark", "historyItem", "tab", "submitButton"
		this.item = null;

		var it = e.originalTarget;
		this.origItem = it;
		var itnn = it.nodeName.toLowerCase();

		// img:
		// if(sets["img"])
		if((itnn == "img" || itnn == "image") && it.src) {
			this.itemType = "img";
			this.item = it;
			return; //~ if(sets["img"].ignoreLinks) return;
		}

		// Link:
		var a = it, ann = itnn;
		while(ann != "#document" && ann != "a") {
			a = a.parentNode;
			ann = a.nodeName.toLowerCase();
		}
		if(ann == "a" && a.href) {
			this.itemType = "link";
			this.item = a;
			return; // return a;
		}

		// Bookmark:

		// History item:
		if(
			/(^|\s+)menuitem-iconic(\s+|$)/.test(it.className)
			&& /(^|\s+)bookmark-item(\s+|$)/.test(it.className)
			&& it.parentNode.id == "goPopup"
		) {
			this.itemType = "historyItem";
			this.item = it;
			return;
		}

		// Tab:
		var tab = it, tnn = itnn;
		while(tnn != "#document" && tnn != "tab" && tnn != "xul:tab") {
			tab = tab.parentNode;
			tnn = tab.nodeName.toLowerCase();
		}
		if(
			(tnn == "tab" || tnn == "xul:tab")
			&& /(^|\s+)tabbrowser-tab(\s+|$)/.test(tab.className)
			&& it.getAttribute("anonid") != "close-button"
		) {
			this.itemType = "tab";
			this.item = tab;
			return;
		}

		// Submit button:
		if(itnn == "input" && it.type == "button") {
			this.itemType = "submitButton";
			this.item = it;
			return;
		}
	},
	getFuncObj: function(sets) {
		if(!this.itemType) // see .defineItem()
			return false;
		var funcObj = sets[this.itemType];
		return funcObj && funcObj.enabled && funcObj.action
			? funcObj
			: false;
	},
	clearCMenuTimeout: function() {
		clearTimeout(this.cMenuTimeout);
	},
	clickHandler: function(e) {
		/**
		if(this.disabled) {
			this.skipTmpDisabled();
			return;
		}

		var evtStr = this.getEvtStr(e);
		var sets = this.getSettings(evtStr);
		if(!sets)
			return;
		if(evtStr != this.strOnMousedown)
			this.defineItem(e, sets);

		var funcObj = this.getFuncObj(sets);
		if(!funcObj)
			return;

		var args = this.argsToArr(funcObj.arguments);
		if(funcObj.custom) { //~ todo
			// try {
			// 	var fnc = new Function(unescape(funcObj.action));
			// 	fnc.apply(totalClicksFuncs, args); // ! totalClicksFuncs is undefined now !
			// } catch(e) { alert(e); }
		}
		else {
			var fnc = totalClicksFuncs[funcObj.action]; // ! totalClicksFuncs is undefined now !
			if(typeof fnc == "function")
				fnc.apply(totalClicksFuncs, args);
		}
		**/

		var oit = this.origItem;
		this._log(
			oit + "\n"
			+ "nodeName -> " + oit.nodeName + "\n"
			+ "itemType -> " + this.itemType
		);
	},
	argsToArr: function(argsObj) {
		argsObj = argsObj || {};
		var args = [];
		for(var p in argsObj)
			args.push(argsObj[p]);
	},
	handleEvent: function(e) {
		switch(e.type) { //~ todo: see https://bugzilla.mozilla.org/show_bug.cgi?id=174320
			case "load":      this.init(e);             break;
			case "unload":    this.destroy(e);          break;
			case "mousedown": this.mousedownHandler(e); break;
			case "click":     this.clickHandler(e);     break;
		}
	},

	consoleServ: Components.classes["@mozilla.org/consoleservice;1"]
		.getService(Components.interfaces.nsIConsoleService),
	_log: function(msg) {
		msg = "[Total Clicks]: " + msg + "\n";
		this.consoleServ.logStringMessage(msg);
	}
};
window.addEventListener("load", totalClicks, false);
window.addEventListener("unload", totalClicks, false);
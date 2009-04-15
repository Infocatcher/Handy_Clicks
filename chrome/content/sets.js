var handyClicksSets = {
	ut: handyClicksUtils, // shortcut
	ps: handyClicksPrefServ, // shortcut
	DOMCache: {},
	okPrefStr: /^button=[0-2],ctrl=(true|false),shift=(true|false),alt=(true|false),meta=(true|false)$/,
	init: function() {
		this.initChortcuts();

		this.drawTree();
		this.updButtons();
		this.ps.addPrefsObserver(this.updTree, this);

		this.updPrefsUI();
		this.ut.addPrefsObserver(this.updPrefsUI, this);
		// <preferences ononchange="handyClicksSets.updPrefsUI();"> return some bugs
	},
	destroy: function() {
		var eds = this.openedEditors, ed;
		for(var hash in eds) {
			ed = eds[hash];
			ed.close();
		}
	},

	/*** Actions pane ***/
	$: function(id) {
		return document.getElementById(id);
	},
	isBuggyModifiersObj: function(mObj) {
		for(var p in mObj) {
			if(!mObj.hasOwnProperty(p))
				continue;
			if(!this.isBuggyFuncObj(mObj[p]))
				return false;
		}
		return true;
	},
	isBuggyFuncObj: function(fObj) {
		return typeof fObj != "object"
			|| typeof fObj.action != "string";
	},
	initChortcuts: function() {
		this.tree = this.$("handyClicks-setsTree");
		this.view = this.tree.view;
		this.content = this.$("handyClicks-setsTreeContent");
		this.cmdDelete = this.$("handyClicks-sets-cmdDelete");
		this.cmdEdit = this.$("handyClicks-sets-cmdEdit");
	},
	drawTree: function() {
		for(var shortcut in handyClicksPrefs) {
			if(!handyClicksPrefs.hasOwnProperty(shortcut))
				continue;
			if(!this.okPrefStr.test(shortcut)) {
				this.ut._err("[Handy Clicks]: invalid shortcut in prefs: " + shortcut);
				continue;
			}
			if(this.isBuggyModifiersObj(handyClicksPrefs[shortcut])) {
				this.ut._err("[Handy Clicks]: invalid modifiers object in prefs: " + shortcut);
				continue;
			}
			var button = this.getButtonStr(shortcut);
			var buttonContainer = this.DOMCache[button] || this.appendContainerItem(null, button, this.ut.getLocalised(button));
			var modifiers = this.convertModifiersStr(shortcut);
			var modifiersContainer = this.DOMCache[shortcut] || this.appendContainerItem(buttonContainer, shortcut, modifiers);
			this.appendItems(modifiersContainer, handyClicksPrefs[shortcut], shortcut);
		}
	},
	redrawTree: function() {
		this.DOMCache = {};
		var cnt = this.content;
		while(cnt.hasChildNodes())
			cnt.removeChild(cnt.lastChild);
		this.drawTree();
	},
	getButtonStr: function(str) {
		return str.substr(0, 8).replace("=", "");
	},
	convertModifiersStr: function(str) {
		str = str
			.replace(/^button=[0-2],|,?[a-z]+=false/g, "")
			.replace(/([a-z])([a-z]+)=true/g, function($0, $1, $2) { return $1.toUpperCase() + $2 })
			.replace(/^,|,$/g, "")
			.replace(/,/g, "+");
		return str ? str : this.ut.getLocalised("none");
	},
	appendContainerItem: function(parent, hash, label) {
		var tItem = document.createElement("treeitem");
		tItem.setAttribute("container", "true");
		tItem.setAttribute("open", "true");
		var tRow = document.createElement("treerow");
		var tSell = document.createElement("treecell");
		tSell.setAttribute("label", label);
		tRow.appendChild(tSell);
		tItem.appendChild(tRow);
		var tChildren = tItem.appendChild(document.createElement("treechildren"));
		(parent || this.content).appendChild(tItem);
		this.DOMCache[hash] = tChildren;
		return tChildren;
	},
	appendItems: function(parent, items, shortcut) {
		var tItem, tRow, it, isCustom;
		// if(items.$all) //~ todo: isOkFuncObj
		//	items = { $all: items.$all };
		for(var itemType in items) {
			if(!items.hasOwnProperty(itemType))
				continue;
			tItem = document.createElement("treeitem");
			tRow = document.createElement("treerow");
			it = items[itemType];
			isCustom = it.custom;
			this.appendTreeCell(tRow, "label", this.ut.getLocalised(isCustom ? "customItemType" : itemType));
			this.appendTreeCell(tRow, "label", it.eventType);
			this.appendTreeCell(tRow, "label", isCustom ? decodeURIComponent(it.label) : this.ut.getLocalised(it.action));
			this.appendTreeCell(tRow, "label", isCustom ? this.ut.getLocalised("customFunction") : it.action);
			this.appendTreeCell(tRow, "label", this.getArguments(it.arguments || {}));
			var chBox = this.appendTreeCell(tRow, "value", it.enabled);
			this.addProperties(chBox, { editable: true });

			this.addProperties(tRow, { disabled: !it.enabled, buggy: this.isBuggyFuncObj(it), custom: isCustom });

			/*
			var props = "";
			if(!it.enabled)
				props += "disabled ";
			if(this.isBuggyFuncObj(it))
				props += "buggy";
			if(props)
				tRow.setAttribute("properties", props);
			*/
			tRow.__shortcut = shortcut;
			tRow.__itemType = itemType;
			tItem.appendChild(tRow);
			parent.appendChild(tItem);
		}
	},
	addProperties: function(tar, propsObj) {
		var propsVal = tar.getAttribute("properties");
		for(var p in propsObj) {
			if(!propsObj.hasOwnProperty(p))
				continue;
			propsVal = propsVal.replace(p, "");
			if(propsObj[p])
				propsVal += " " + p;
		}
		tar.setAttribute("properties", propsVal.replace(/^\s+|\s+$/, "").replace(/\s+/, " "));
	},
	appendTreeCell: function(parent, attrName, attrValue) {
		var cell = document.createElement("treecell");
		cell.setAttribute(attrName, attrValue);
		return parent.appendChild(cell);
	},
	getArguments: function(argsObj) {
		var res = [];
		for(var p in argsObj)
			if(argsObj.hasOwnProperty(p))
				res.push(p + " = " + this.convertToString(argsObj[p])); //~ todo: this.ut.getLocalised(p)
		return res.join(", ");
	},
	convertToString: function(x) {
		return typeof x == "string" ? '"' + x + '"' : x;
	},
	updTree: function() {
		this.redrawTree();
		this.updButtons();
	},
	updButtons: function() {
		var noSel = !this.selectedRows.length;
		["cmdDelete", "cmdEdit"].forEach(
			function(hash) { this[hash].setAttribute("disabled", noSel); },
			this
		);
	},
	get selectedRows() {
		var numRanges = this.view.selection.getRangeCount();
		var tRowsArr = [];
		if(numRanges == 0)
			return tRowsArr;
		var start = {};
		var end = {};
		var tRows = this.content.getElementsByTagName("treerow"), tRow;
		for(var t = 0; t < numRanges; t++) {
			this.view.selection.getRangeAt(t, start, end);
			for(var v = start.value; v <= end.value; v++) {
				tRow = tRows[v];
				if(tRow.__shortcut && tRow.__itemType)
					tRowsArr.push(tRows[v]); // for deleting (getElementsByTagName is dinamically)
			}
		}
		return tRowsArr;
	},
	addItems: function() {
		this.openEditorWindow(null);
	},
	editItems: function(e) {
		if(e && !this.isClickOnRow(e)) {
			this.addItems();
			return;
		}
		if(e && e.button && e.button != 0)
			return;
		this.selectedRows.forEach(this.openEditorWindow, this);
	},
	isClickOnRow: function(e) {
		var row = {}, col = {}, obj = {};
		this.tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, obj);
		return row.value > -1;
	},
	deleteItems: function() {
		var tRows = this.selectedRows;
		if(!tRows.length)
			return;
		if(confirm("Are you sure to delete " + tRows.length + " item(s)?")) //~ todo: promptsServ
			tRows.forEach(this.deleteItem, this);
	},
	deleteItem: function(tRow) {
		var shortcut = tRow.__shortcut;
		var itemType = tRow.__itemType;
		if(shortcut && itemType) {
			var shortcutObj = handyClicksPrefs[shortcut];
			delete(shortcutObj[itemType]);
			if(this.isEmptyObj(shortcutObj))
				delete(handyClicksPrefs[shortcut]);

			var tItem = tRow.parentNode;
			var tChld = tItem.parentNode;
			tChld.removeChild(tItem);
			for(var i = 0; i < 2; i++)
				if(!tChld.hasChildNodes()) {
					tItem = tChld.parentNode;
					tChld = tItem.parentNode;
					tChld.removeChild(tItem);
				}
		}
	},
	isEmptyObj: function(obj) {
		for(var p in obj)
			if(obj.hasOwnProperty(p))
				return false;
		return true;
	},
	openedEditors: { __proto__: null },
	openEditorWindow: function(tRow, mode) {
		var shortcut = tRow ? tRow.__shortcut : Date.now() + "-" + Math.random();
		var itemType = tRow ? tRow.__itemType : null;
		//if(!shortcut || !itemType)
		//	return;

		var hash = shortcut + "-" + itemType;
		if(this.openedEditors[hash]) {
			this.openedEditors[hash].focus();
			return;
		}
		var win = window.openDialog( // window.openDialog => modal windows...
			"chrome://handyclicks/content/editor.xul",
			"",
			"chrome,resizable,dependent,centerscreen,dialog=0", // alwaysRaised
			mode || "shortcut", shortcut, itemType
		);

		if(tRow)
			this.addProperties(tRow, { edited: true });

		var _this = this;
		win.addEventListener("load", function(e) {
			win.removeEventListener(e.type, arguments.callee, false);
			win.addEventListener(
				"unload",
				function(e) {
					win.removeEventListener(e.type, arguments.callee, false);
					delete(_this.openedEditors[hash]);
					if(tRow)
						_this.addProperties(tRow, { edited: false });
				},
				false
			);
		}, false);
		this.openedEditors[hash] = win;
	},
	toggleEnabled: function(e) {
		var row = {}, col = {}, obj = {};
		this.tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, obj);
		if(row.value == -1 || col.value == null)
			return;
		var checked = this.tree.view.getCellValue(row.value, col.value);
		if(!checked) // real checked is "true" or "false"
			return;
		var enabled = checked != "true";
		var tRow = this.content.getElementsByTagName("treerow")[row.value];
		this.addProperties(tRow, { disabled: !enabled });
		var tCell = tRow.getElementsByTagName("treecell")[col.value.index];
		tCell.setAttribute("value", enabled);

		handyClicksPrefs[tRow.__shortcut][tRow.__itemType].enabled = enabled;
	},

	/*** Prefs pane ***/
	updPrefsUI: function() {
		this.loadPrefs();
		// setTimeout(function(_this) { _this.loadPrefs(); }, 0, this);
		this.updateAllDependencies();
		this.showPrefs();
	},
	loadPrefs: function() {
		var id = "disallowMousemoveForButtons";
		var buttons = this.ut.pref(id);
		for(var i = 0; i <= 2; i++)
			this.$(id + "-" + i).checked = buttons.indexOf(i) > -1;
	},
	savePrefs: function() {
		var id = "disallowMousemoveForButtons";
		var val = "";
		for(var i = 0; i <= 2; i++)
			if(this.$(id + "-" + i).checked)
				val += i;
		this.ut.setPref("extensions.handyclicks." + id, val);
		this.ps.saveSettingsObjects();
	},
	showPrefs: function(enablIt) {
		enablIt = enablIt || this.$("handyClicks-sets-enabled");
		enablIt.setAttribute("hideallafter", enablIt.getAttribute("checked") != "true");
	},
	updateAllDependencies: function() {
		var reqs = document.getElementsByAttribute("requiredfor", "*");
		for(var i = 0, len = reqs.length; i < len; i++)
			this.updateDependencies(reqs[i]);
	},
	prefsChanged: function(e) {
		var tar = e.target;
		if(tar.nodeName == "menuitem")
			tar = tar.parentNode.parentNode;
		if(tar.hasAttribute("requiredfor"))
			this.updateDependencies(tar);
		if(this.ut.getPref("browser.preferences.instantApply")) //~ todo: hidden textbox?
			this.savePrefs();
	},
	updateDependencies: function(it) {
		var dis = it.hasAttribute("disabledvalues")
			? new RegExp("(^|\\s+)" + it.value + "(\\s+|$)").test(it.getAttribute("disabledvalues"))
			: it.getAttribute("checked") != "true";
		it.getAttribute("requiredfor").split(" ").forEach(
			function(req) {
				var deps = document.getElementsByAttribute("dependencies", req);
				for(var i = 0, len = deps.length; i < len; i++)
					this.desableChilds(deps[i], dis); // deps[i].disabled = dis;
			},
			this
		);
	},
	desableChilds: function(parent, dis) {
		parent.disabled = dis;
		var childs = parent.childNodes;
		for(var i = 0, len = childs.length; i < len; i++)
			this.desableChilds(childs[i], dis);
	}
};
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

		this.instantApply = this.ut.getPref("browser.preferences.instantApply");
		if(this.instantApply)
			this.applyButton.hidden = true;
		else
			this.toggleApply(true);
	},
	destroy: function() {
		var eds = this.openedEditors, ed;
		for(var hash in eds) {
			ed = eds[hash];
			ed.close();
		}
	},

	get applyButton() {
		if(!this._applyButton)
			this._applyButton = document.documentElement.getButton("extra1");
		return this._applyButton;
	},
	toggleApply: function(dis) {
		this.applyButton.disabled = dis;
	},

	/*** Actions pane ***/
	$: function(id) {
		return document.getElementById(id);
	},
	initChortcuts: function() {
		this.tree = this.$("handyClicks-setsTree");
		this.view = this.tree.view;
		this.selection = this.view.selection;
		this.content = this.$("handyClicks-setsTreeContent");
		this.cmdDelete = this.$("handyClicks-sets-cmdDelete");
		this.cmdEdit = this.$("handyClicks-sets-cmdEdit");
		this.searcher._tree = this.tree;
	},
	drawTree: function() {
		for(var shortcut in handyClicksPrefs) {
			if(!handyClicksPrefs.hasOwnProperty(shortcut))
				continue;
			if(!this.ps.isOkShortcut(shortcut)) {
				this.ut._err("[Handy Clicks]: invalid shortcut in prefs: " + shortcut);
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
		var tItem, tRow, it, isCustom, isCustomType;
		var isBuggy = false;
		for(var itemType in items) {
			if(!items.hasOwnProperty(itemType))
				continue;
			tItem = document.createElement("treeitem");
			tRow = document.createElement("treerow");
			it = items[itemType];
			isCustom = it.custom;
			isCustomType = itemType.indexOf("custom_") == 0;
			this.appendTreeCell(tRow, "label", isCustomType ? itemType : this.ut.getLocalised(itemType));
			this.appendTreeCell(tRow, "label", it.eventType);
			this.appendTreeCell(tRow, "label", isCustom ? decodeURIComponent(it.label) : this.ut.getLocalised(it.action));
			this.appendTreeCell(tRow, "label",
				isCustom ? this.ut.getLocalised("customFunction") + decodeURIComponent(it.action) : it.action
			);
			this.appendTreeCell(tRow, "label", this.getArguments(it.arguments || {}));
			var chBox = this.appendTreeCell(tRow, "value", it.enabled);
			this.addProperties(chBox, { editable: true });

			isBuggy = !this.ps.isOkFuncObj(it)
				|| (isCustomType && !handyClicksCustomTypes.hasOwnProperty(itemType));
			this.addProperties(tRow, { disabled: !it.enabled, buggy: isBuggy, custom: isCustom });

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
		return res.join(", \n");
	},
	convertToString: function(x) {
		return typeof x == "string" ? '"' + x + '"' : x;
	},
	updTree: function() {
		var tbo = this.tree.treeBoxObject;
		var fvr = tbo.getFirstVisibleRow();
		var numRanges = this.selection.getRangeCount();
		var selRow;
		if(numRanges > 0) {
			var start = {}, end = {};
			this.selection.getRangeAt(0, start, end);
			selRow = start.value;
		}

		this.redrawTree();
		this.updButtons();

		if(selRow)
			this.selection.select(selRow);
		if(fvr)
			tbo.scrollToRow(fvr);
		this.searchInSetsTree();
	},
	updButtons: function() {
		var noSel = !this.selectedRows.length;
		["cmdDelete", "cmdEdit"].forEach(
			function(hash) { this[hash].setAttribute("disabled", noSel); },
			this
		);
	},
	get selectedRows() {
		var numRanges = this.selection.getRangeCount();
		var tRowsArr = [];
		if(numRanges == 0)
			return tRowsArr;
		var start = {};
		var end = {};
		var tRows = this.content.getElementsByTagName("treerow"), tRow;
		for(var t = 0; t < numRanges; t++) {
			this.selection.getRangeAt(t, start, end);
			for(var v = start.value; v <= end.value; v++) {
				tRow = tRows[v];
				if(tRow.__shortcut && tRow.__itemType) {
					tRowsArr.push(tRow); // for deleting (getElementsByTagName is dinamically)
					tRow.__index = v;
				}
			}
		}
		return tRowsArr;
	},
	get isTreePaneSelected() {
		var prefWin = this.$("handyClicks-settings");
		return prefWin.currentPane == prefWin.preferencePanes[0];
	},
	addItems: function() {
		if(this.isTreePaneSelected)
			this.openEditorWindow(null);
	},
	editItems: function(e) {
		if(e && !this.isClickOnRow(e)) {
			this.addItems();
			return;
		}
		if(e && e.button && e.button != 0)
			return;
		if(!this.isTreePaneSelected)
			return;
		this.selectedRows.forEach(this.openEditorWindow, this);
	},
	isClickOnRow: function(e) {
		var row = {}, col = {}, obj = {};
		this.tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, obj);
		return row.value > -1;
	},
	deleteItems: function() {
		if(!this.isTreePaneSelected)
			return;
		var tRows = this.selectedRows;
		if(!tRows.length)
			return;
		if(
			!this.ut.confirmEx(
				this.ut.getLocalised("title"),
				this.ut.getLocalised("deleteConfirm").replace("%n", tRows.length)
			)
		)
			return;
		tRows.forEach(this.deleteItem, this);
		this.toggleApply(false);
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
		var rowIndx, column, tRow;
		if(e) {
			var row = {}, col = {}, obj = {};
			this.tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, obj);
			if(row.value == -1 || col.value == null)
				return;
			rowIndx = row.value;
			column = col.value;
		}
		else { // Space button pressed
			var fi = document.commandDispatcher.focusedElement;
			if(fi && fi.nodeName != "tree")
				return;
			var rows = this.selectedRows;
			if(rows.length != 1)
				return;
			tRow = rows[0];
			rowIndx = tRow.__index;
			var columns = this.tree.columns;
			column = columns[columns.length - 1];
		}
		var checked = this.tree.view.getCellValue(rowIndx, column);
		if(!checked) // real checked is "true" or "false"
			return;
		var enabled = checked != "true";
		tRow = tRow || this.content.getElementsByTagName("treerow")[rowIndx];
		this.addProperties(tRow, { disabled: !enabled });
		var tCell = tRow.getElementsByTagName("treecell")[column.index];
		tCell.setAttribute("value", enabled);

		handyClicksPrefs[tRow.__shortcut][tRow.__itemType].enabled = enabled;
		if(this.instantApply)
			this.ps.saveSettingsObjects();
		else
			this.toggleApply(false);
	},

	/*** Prefs pane ***/
	updPrefsUI: function() {
		this.loadPrefs();
		this.updateAllDependencies();
		this.showPrefs();
	},
	loadPrefs: function() {
		var id = "disallowMousemoveForButtons";
		var buttons = this.ut.pref(id);
		for(var i = 0; i <= 2; i++)
			this.$(id + "-" + i).checked = buttons.indexOf(i) > -1;
	},
	savePrefs: function(applyFlag) {
		var id = "disallowMousemoveForButtons";
		var val = "";
		for(var i = 0; i <= 2; i++)
			if(this.$(id + "-" + i).checked)
				val += i;
		this.ut.setPref("extensions.handyclicks." + id, val);
		this.ps.saveSettingsObjects();
		if(applyFlag && !this.instantApply) {
			this.savePrefpanes();
			this.toggleApply(true);
		}
	},
	savePrefpanes: function() {
		var pps = document.getElementsByTagName("prefpane");
		for(var i = 0, len = pps.length; i < len; i++)
			pps[i].writePreferences(true); // aFlushToDisk
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
		if(tar.nodeName == "prefwindow") {
			this.focusSearch(e);
			return;
		}
		if(tar.nodeName == "menuitem")
			tar = tar.parentNode.parentNode;
		if(tar.hasAttribute("requiredfor"))
			this.updateDependencies(tar);
		if(!tar.hasAttribute("preference") && tar.nodeName != "checkbox")
			return;
		if(this.instantApply)
			this.savePrefs();
		else
			this.toggleApply(false);
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
	},

	focusSearch: function(e) {
		var sIt = this.$("handyClicks-setsTreeSearch");
		sIt.select();
		sIt.focus();
	},

	_alloySearch: true,
	_searchTimeout: null,
	_searchDelay: 50,
	_tryInterval: 20,
	searcher: {
		_res: [], // row numbers
		_tree: null,
		_current: 0,
		clear: function() { this._res = []; this._current = 0; },
		add: function(r) { this._res.push(r); },
		get _length() { return this._res.length; },
		next: function() {
			if(++this._current >= this._length)
				this._current = 0;
			this.select();
		},
		prev: function() {
			if(--this._current < 0)
				this._current = this._length - 1;
			this.select();
		},
		select: function(i) {
			if(typeof i != "number") {
				if(!this._length)
					return;
				i = this._res[this._current];
			}
			this._tree.view.selection.select(i);
			this._tree.treeBoxObject.ensureRowIsVisible(i);
		}
	},
	navigateSearchResults: function(e) {
		if(e.keyCode == e.DOM_VK_DOWN)
			this.searcher.next();
		else if(e.keyCode == e.DOM_VK_UP)
			this.searcher.prev();
		else
			return;
		e.preventDefault();
	},
	_searchInSetsTree: function(sIt) {
		setTimeout(function(_this, sIt) { _this.searchInSetsTree(sIt); }, 0, this, sIt);
	},
	searchInSetsTree: function(sIt) {
		if(sIt && !this._alloySearch) {
			clearTimeout(this._searchTimeout);
			this._searchTimeout = setTimeout(
				function(_this, _a) {
					_a.callee.apply(_this, _a);
				},
				this._tryInterval,
				this, arguments
			);
			return;
		}
		this._alloySearch = false;
		this.searcher.clear();
		sIt = sIt || this.$("handyClicks-setsTreeSearch");
		var sVal = sIt.value.replace(/^\s+|\s+$/g, "");
		var _sVal = sVal.toLowerCase().split(/\s+/);
		var sLen = _sVal.length;
		var hasVal = !!sVal;

		var tmp, t;
		var tRows = this.content.getElementsByTagName("treerow"), tRow;
		var its, it;
		var tRes, notFound = true;
		for(var i = 0, rLen = tRows.length; i < rLen; i++) {
			tRow = tRows[i];
			if(tRow.__shortcut && tRow.__itemType) {
				tRes = hasVal;
				tmp = [];
				its = tRow.getElementsByAttribute("label", "*");
				for(var j = 0, lLen = its.length; j < lLen; j++)
					tmp.push(its[j].getAttribute("label"));
				t = tmp.join("\n").toLowerCase();
				if(hasVal)
					for(var k = 0; k < sLen; k++)
						if(t.indexOf(_sVal[k]) == -1)
							tRes = false;
				this.addProperties(tRow, { search: tRes });
				if(tRes) {
					this.searcher.add(i);
					if(notFound) {
						notFound = false;
						this.searcher.select(i);
					}
				}
			}
		}
		sIt.setAttribute("hc_notfound", hasVal && notFound);
		setTimeout(function(_this) { _this._alloySearch = true; }, this._searchDelay, this);
	}
};
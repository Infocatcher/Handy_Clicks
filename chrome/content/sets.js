var handyClicksSets = {
	// Shortcuts:
	ut: handyClicksUtils,
	wu: handyClicksWinUtils,
	pu: handyClicksPrefUtils,
	ps: handyClicksPrefSvc,

	init: function() {
		this.ps.loadSettings();
		this.initShortcuts();

		this.drawTree();
		this.updButtons();
		this.ps.addPrefsObserver(this.updTree, this);

		this.updPrefsUI();
		this.pu.addPrefsObserver(this.updPrefsUI, this);
		// <preferences onchange="handyClicksSets.updPrefsUI();"> return some bugs

		if(this.ut.fxVersion >= 3.5) {
			var s = this.$("hc-sets-tree-searchField");
			s.type = "search";
			s._clearSearch = function() { this.value = ""; this.oninput && this.oninput(); };
		}

		this.instantApply = this.pu.getPref("browser.preferences.instantApply");
		if(this.instantApply)
			this.applyButton.hidden = true;
		else
			this.applyButton.disabled = true;
		var prefsButt = document.documentElement.getButton("extra2");
		prefsButt.setAttribute("popup", "hc-sets-prefsManagementPopup");
		prefsButt.setAttribute("accesskey", prefsButt.getAttribute("label").charAt(0));
		this.focusSearch();
	},
	initShortcuts: function() {
		this.tree = this.$("hc-sets-tree");
		this.view = this.tree.view;
		this.selection = this.view.selection;
		this.content = this.$("hc-sets-tree-content");
		this.cmdDelete = this.$("hc-sets-cmd-delete");
		this.cmdEdit = this.$("hc-sets-cmd-edit");
		this.cmdEditType = this.$("hc-sets-cmd-editType");
		this.miEditType = this.$("hc-sets-editType");
		this.searcher._tree = this.tree;
		this.applyButton = document.documentElement.getButton("extra1");
	},

	/*** Actions pane ***/
	$: function(id) {
		return document.getElementById(id);
	},
	drawTree: function() {
		this.DOMCache = { __proto__: null };
		this.rowsCache = { __proto__: null };
		var p = handyClicksPrefs;
		for(var sh in p) if(p.hasOwnProperty(sh)) {
			if(!this.ps.isOkShortcut(sh) || !this.ut.isObject(p[sh])) {
				this.ut._err(this.ut.errPrefix + "Invalid shortcut in prefs: " + sh);
				continue;
			}
			var button = this.ps.getButtonStr(sh);
			var buttonContainer = this.DOMCache[button] || this.appendContainerItem(null, button, this.ut.getLocalized(button));
			var modifiers = this.ps.getModifiersStr(sh);
			var modifiersContainer = this.DOMCache[sh] || this.appendContainerItem(buttonContainer, sh, modifiers);
			this.appendItems(modifiersContainer, p[sh], sh);
		}
		this.highlightAllOpened();
	},
	highlightAllOpened: function() {
		for(var rowId in this.rowsCache)
			this.setRowStatus(rowId, false);

		var wProp = this.wu.winIdProp;
		var ws = this.wu.wm.getEnumerator("handyclicks:editor");
		var w;
		while(ws.hasMoreElements()) {
			w = ws.getNext();
			if(wProp in w)
				this.setRowStatus(w[wProp], true);
		}
	},
	redrawTree: function() {
		var cnt = this.content;
		while(cnt.hasChildNodes())
			cnt.removeChild(cnt.lastChild);
		this.drawTree();
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
		var tItem, tRow, it, typeLabel, isCustom, isCustomType;
		var isBuggy = false;
		for(var itemType in items) if(items.hasOwnProperty(itemType)) {
			tItem = document.createElement("treeitem");
			tRow = document.createElement("treerow");
			it = items[itemType];
			isCustom = !!it.custom;
			isCustomType = itemType.indexOf("custom_") == 0;
			typeLabel = isCustomType
				? this.getCustomTypeLabel(itemType)
				: this.ut.getLocalized(itemType);
			this.appendTreeCell(tRow, "label", typeLabel);
			this.appendTreeCell(tRow, "label", it.eventType);
			this.appendTreeCell(tRow, "label", isCustom ? this.ps.dec(it.label) : this.ut.getLocalized(it.action));
			this.appendTreeCell(tRow, "label",
				isCustom
					? this.fixOldTree(this.ut.getLocalized("customFunction") + this.ps.dec(it.action))
					: it.action
			);
			this.appendTreeCell(tRow, "label", this.getArguments(it.arguments || {}));
			var chBox = this.appendTreeCell(tRow, "value", it.enabled);
			this.addProperties(chBox, { hc_editable: true });

			isBuggy = !this.ps.isOkFuncObj(it)
				|| (isCustomType && !handyClicksCustomTypes.hasOwnProperty(itemType));
			this.addProperties(tRow, { hc_disabled: !it.enabled, hc_buggy: isBuggy, hc_custom: isCustom || isCustomType });

			tRow.__shortcut = shortcut;
			tRow.__itemType = itemType;
			tRow.__isCustomType = isCustomType;
			tItem.appendChild(tRow);
			parent.appendChild(tItem);
			this.rowsCache[shortcut + "-" + itemType] = tRow;
		}
	},
	getCustomTypeLabel: function(type) {
		var ct = this.ut.getOwnProperty(handyClicksCustomTypes, type) || {};
		var label = this.ut.getOwnProperty(ct, "label");
		return (label ? this.ps.dec(label) + " " : "") + "(" + type + ")";
	},
	addProperties: function(tar, propsObj) {
		var propsVal = tar.getAttribute("properties");
		for(var p in propsObj) if(propsObj.hasOwnProperty(p)) {
			propsVal = propsVal.replace(new RegExp("(?:^|\\s)" + p + "(?:\\s|$)"), " ");
			if(propsObj[p])
				propsVal += " " + p;
		}
		tar.setAttribute("properties", propsVal.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " "));
	},
	appendTreeCell: function(parent, attrName, attrValue) {
		var cell = document.createElement("treecell");
		cell.setAttribute(attrName, attrValue);
		return parent.appendChild(cell);
	},
	fixOldTree: function(s) {
		return this.ut.fxVersion <= 2
			? ("" + s).replace(/\r\n|\r|\n|\t/g, " ")
			: s;
	},
	getArguments: function(argsObj) {
		var res = [];
		for(var p in argsObj) if(argsObj.hasOwnProperty(p))
			res.push(p + " = " + uneval(argsObj[p])); //~ todo: this.ut.getLocalized(p) ?
		return res.join(this.fixOldTree(",\n"));
	},
	updTree: function() {
		var tbo = this.tree.treeBoxObject;
		var fvr = tbo.getFirstVisibleRow();
		var numRanges = this.selection.getRangeCount();
		var selRows = [];
		var start = {}, end = {};
		for(var i = 0; i < numRanges; i++) {
			this.selection.getRangeAt(i, start, end);
			selRows.push([start.value, end.value]);
		}

		this.redrawTree();
		//this.updButtons();

		selRows.forEach(
			function(range) {
				this.selection.rangedSelect(range[0], range[1], true);
			},
			this
		);
		if(typeof fvr == "number")
			tbo.scrollToRow(fvr);
		this.searchInSetsTree(null, true);
		this.applyButton.disabled = true;
	},
	forceUpdTree: function() {
		this.ps.loadSettings();
		this.updTree();
	},
	updButtons: function() {
		var selRows = this.selectedRows;
		var noSel = !selRows.length;
		["cmdDelete", "cmdEdit"].forEach(
			function(hash) { this[hash].setAttribute("disabled", noSel); },
			this
		);
		var noTypes = noSel || !selRows.some(function(row) { return row.__isCustomType; });
		this.cmdEditType.setAttribute("disabled", noTypes);
		this.miEditType.hidden = noTypes;
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
				if(!tRow || this.view.isContainer(v))
					continue;
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
	switchPanes: function(nextFlag) {
		var prefWin = this.$("handyClicks-settings");
		var curPane = prefWin.currentPane;
		var panes = prefWin.preferencePanes, pLen = panes.length;
		for(var n = 0; n < pLen; n++)
			if(panes[n] == curPane)
				break;
		n += nextFlag ? 1 : -1;
		if(n >= pLen)  n = 0;
		else if(n < 0) n = pLen - 1;
		prefWin.showPane(panes[n]);
		this.focusSearch();
	},
	addItems: function() {
		if(!this.isTreePaneSelected)
			return;
		var rows = this.selectedRows;
		if(rows.length == 1)
			this.openEditorWindow(rows[0], "shortcut", true);
		else
			this.openEditorWindow();
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
	editItemsTypes: function() {
		if(!this.isTreePaneSelected)
			return;
		this.selectedRows.forEach(
			function(row) {
				if(row.__isCustomType)
					this.openEditorWindow(row, "itemType");
			},
			this
		);
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

		var del = tRows.map(
			function(tRow, i) {
				tRow = tRows[i];
				var mdfs = this.ps.getModifiersStr(tRow.__shortcut);
				var button = this.ps.getLocaleButtonStr(tRow.__shortcut, true);
				var type = tRow.__itemType.indexOf("custom_") == 0
					? this.getCustomTypeLabel(tRow.__itemType)
					: this.ut.getLocalized(tRow.__itemType);
				var fObj = this.ut.getOwnProperty(handyClicksPrefs, tRow.__shortcut, tRow.__itemType);
				var label = typeof fObj == "object"
					? this.ut.getOwnProperty(fObj, "custom")
						? this.ps.dec(fObj.label || "")
						: this.ut.getLocalized(fObj.action || "")
					: "?";
				return mdfs + " + " + button + " + " + type + " \u21d2 " + label.substr(0, 42); // "=>" symbol
			},
			this
		);
		var maxRows = 12;
		if(del.length > maxRows)
			del.splice(maxRows - 2, del.length - maxRows + 1, "\u2026"); // "..." symbol

		if(
			!this.ut.confirmEx(
				this.ut.getLocalized("title"),
				this.ut.getLocalized("deleteConfirm").replace("%n", tRows.length)
					+ "\n\n" + del.join("\n")
			)
		)
			return;
		tRows.forEach(this.deleteItem, this);
		this.applyButton.disabled = false;
	},
	deleteItem: function(tRow) {
		var sh = tRow.__shortcut;
		var type = tRow.__itemType;
		if(!sh || !type)
			return;
		var p = handyClicksPrefs;
		var so = p[sh];
		delete so[type];
		if(this.isEmptyObj(so))
			delete p[sh];
		var tItem = tRow.parentNode;
		var tChld = tItem.parentNode;
		tChld.removeChild(tItem);
		for(var i = 0; i < 2; i++) {
			if(tChld.hasChildNodes())
				break;
			tItem = tChld.parentNode;
			tChld = tItem.parentNode;
			tChld.removeChild(tItem);
		}
	},
	isEmptyObj: function(obj) {
		for(var p in obj) if(obj.hasOwnProperty(p))
			return false;
		return true;
	},
	openEditorWindow: function(tRow, mode, add) { // mode: "shortcut" or "itemType"
		var shortcut = tRow ? tRow.__shortcut : Date.now() + "-" + Math.random();
		var itemType = tRow && add !== true ? tRow.__itemType : null;
		this.wu.openEditor(mode, shortcut, itemType);
	},
	setRowStatus: function(rowId, editStat) {
		if(!(rowId in this.rowsCache))
			return;
		Array.prototype.forEach.call( // Status for all cells in row
			this.rowsCache[rowId].getElementsByTagName("treecell"),
			function(cell) {
				this.addProperties(cell, { hc_edited: editStat });
			},
			this
		);
		// this.addProperties(this.rowsCache[rowId], { hc_edited: editStat });
	},
	toggleEnabled: function(e) {
		var rowIndx, column, tRow;
		var changed = true;
		if(e) {
			if(e.button != 0)
				return;
			var row = {}, col = {}, obj = {};
			this.tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, obj);
			if(row.value == -1 || col.value == null)
				return;
			rowIndx = row.value;
			column = col.value;
			changed = this.toggleRowEnabled(rowIndx, column, tRow);
		}
		else { // Space button pressed
			var fi = document.commandDispatcher.focusedElement;
			if(fi && fi.localName != "tree")
				return;
			var rows = this.selectedRows;
			if(!rows.length)
				return;
			var columns = this.tree.columns;
			column = columns[columns.length - 1];
			rows.forEach(
				function(tRow) {
					this.toggleRowEnabled(tRow.__index, column, tRow);
				},
				this
			);
		}
		if(!changed)
			return;
		if(this.instantApply)
			this.ps.saveSettingsObjects(true);
		else
			this.applyButton.disabled = false;
	},
	toggleRowEnabled: function(rowIndx, column, tRow) {
		var checked = this.view.getCellValue(rowIndx, column);
		if(!checked) // real checked is "true" or "false"
			return false;
		var enabled = checked != "true";
		tRow = tRow || this.content.getElementsByTagName("treerow")[rowIndx];
		this.addProperties(tRow, { disabled: !enabled });
		var tCell = tRow.getElementsByTagName("treecell")[column.index];
		tCell.setAttribute("value", enabled);
		handyClicksPrefs[tRow.__shortcut][tRow.__itemType].enabled = enabled;
		return true;
	},
	selectAll: function() {
		if(this.isTreePaneSelected)
			this.selection.selectAll();
	},

	/*** Search in tree ***/
	focusSearch: function(e) {
		if(!this.isTreePaneSelected)
			return;
		var sIt = this.$("hc-sets-tree-searchField");
		if(!sIt)
			return;
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
	searchInSetsTree: function(sIt, notSelect) {
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
		sIt = sIt || this.$("hc-sets-tree-searchField");
		var sVal = sIt.value.replace(/^\s+|\s+$/g, "");
		var _sVal = sVal.toLowerCase().split(/\s+/);
		var sLen = _sVal.length;
		var hasVal = !!sVal;

		var tRows = this.content.getElementsByTagName("treerow"), tRow;
		var labels, tmpArr, rowText;
		var okRow, notFound = true;
		var i, j, k, rLen, lLen;
		for(i = 0, rLen = tRows.length; i < rLen; i++) {
			tRow = tRows[i];
			if(tRow.__shortcut && tRow.__itemType) {
				okRow = hasVal;
				tmpArr = [];
				labels = tRow.getElementsByAttribute("label", "*");
				for(j = 0, lLen = labels.length; j < lLen; j++)
					tmpArr.push(labels[j].getAttribute("label"));
				rowText = tmpArr.join("\n").toLowerCase();
				if(hasVal)
					for(k = 0; k < sLen; k++)
						if(rowText.indexOf(_sVal[k]) == -1)
							okRow = false;
				this.addProperties(tRow, { hc_search: okRow });
				if(okRow) {
					this.searcher.add(i);
					if(notFound) {
						notFound = false;
						if(!notSelect) // Don't select for redraw
							this.searcher.select(i);
					}
				}
			}
		}
		sIt.setAttribute("hc_notfound", hasVal && notFound);
		setTimeout(function(_this) { _this._alloySearch = true; }, this._searchDelay, this);
	},

	/*** Prefs pane ***/
	updPrefsUI: function() {
		this.loadPrefs();
		this.updateAllDependencies();
	},
	loadPrefs: function() {
		var buttons = this.pu.pref("disallowMousemoveButtons");
		for(var i = 0; i <= 2; i++)
			this.$("hc-sets-disallowMousemove-" + i).checked = buttons.indexOf(i) > -1;
	},
	savePrefs: function(applyFlag) {
		var val = "";
		for(var i = 0; i <= 2; i++)
			if(this.$("hc-sets-disallowMousemove-" + i).checked)
				val += i;
		this.pu.pref("disallowMousemoveButtons", val);
		this.ps.saveSettingsObjects(applyFlag);
		if(applyFlag && !this.instantApply) {
			this.savePrefpanes();
			this.applyButton.disabled = true;
		}
	},
	savePrefpanes: function() {
		var pps = document.getElementsByTagName("prefpane");
		for(var i = 0, len = pps.length; i < len; i++)
			pps[i].writePreferences(true); // aFlushToDisk
	},
	prefsChanged: function(e) {
		var tar = e.target;
		if(tar.localName == "prefwindow") {
			this.focusSearch(e);
			return;
		}
		if(tar.localName == "menuitem")
			tar = tar.parentNode.parentNode;
		if(tar.hasAttribute("hc_requiredfor"))
			this.updateDependencies(tar, true);
		if(!tar.hasAttribute("preference") && tar.localName != "checkbox")
			return;
		if(this.instantApply)
			this.savePrefs();
		else
			this.applyButton.disabled = false;
	},
	updateAllDependencies: function() {
		Array.prototype.forEach.call(
			document.getElementsByAttribute("hc_requiredfor", "*"),
			this.updateDependencies,
			this
		);
	},
	updateDependencies: function(it, checkAll) {
		var checkParent = it.getAttribute("hc_checkparent") == "true";
		if(checkParent && checkAll !== true)
			return;
		var dis = it.hasAttribute("hc_disabledvalues")
			? new RegExp("(?:^|\\s)" + it.value + "(?:\\s|$)").test(it.getAttribute("hc_disabledvalues"))
			: it.hasAttribute("checked") && !checkParent
				? it.getAttribute("checked") != "true"
				: Array.prototype.every.call(
					(checkParent ? it.parentNode : it).getElementsByTagName("checkbox"),
					function(ch) { return ch.getAttribute("checked") != "true"; }
				);
		it.getAttribute("hc_requiredfor").split(/\s+/).forEach(
			function(req) {
				var deps = document.getElementsByAttribute("hc_depends", req);
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

	// about:config entries
	// Reset prefs:
	resetPrefs: function() {
		this.pu.prefSvc.getBranch(this.pu.nPrefix)
			.getChildList("", {})
			.forEach(this.resetPref, this);
	},
	resetPref: function(pName) {
		this.pu.resetPref(this.pu.nPrefix + pName);
	},
	// Export/import:
	exportPrefsHeader: "[Handy Clicks settings]",
	exportPrefs: function() {
		var file = this.pickFile(this.ut.getLocalized("exportPrefs"), true, "ini");
		if(!file)
			return;
		var data = this.exportPrefsHeader + "\n"
			+ this.pu.prefSvc.getBranch(this.pu.nPrefix)
				.getChildList("", {})
				.map(
					function(pName) {
						return this.pu.nPrefix + pName + "=" + this.pu.pref(pName);
					},
					this
				).sort().join("\n");
		this.ut.writeToFile(data, file);
		this.backupsDir = file.parent.path;
	},
	importPrefs: function() {
		var file = this.pickFile(this.ut.getLocalized("importPrefs"), false, "ini");
		if(!file)
			return;
		var str = this.ut.readFromFile(file);
		if(str.indexOf(this.exportPrefsHeader) != 0) {
			this.ut.alertEx(
				this.ut.getLocalized("importErrorTitle"),
				this.ut.getLocalized("invalidConfigFile")
			);
			return;
		}
		this.backupsDir = file.parent.path;
		str.replace(/[\r\n]{1,100}/g, "\n").split(/[\r\n]+/)
			.splice(1) // Remove header
			.forEach(
				function(line, i) {
					var indx = line.indexOf("=");
					if(indx == -1) {
						this.ut._err(this.ut.errPrefix + "[Import INI] Skipped invalid line #" + i + ": " + line);
						return;
					}
					var pName = line.substring(0, indx);
					var pbr = Components.interfaces.nsIPrefBranch;
					var pType = this.pu.prefSvc.getPrefType(pName);
					if(pType == pbr.PREF_INVALID || pName.indexOf(this.pu.nPrefix) != 0) {
						this.ut._err(this.ut.errPrefix + "[Import INI] Skipped pref with invalid name: " + pName);
						return;
					}
					var pVal = line.substring(indx + 1);
					if(pType == pbr.PREF_INT) // Convert string to number or boolean
						pVal = parseInt(pVal);
					else if(pType == pbr.PREF_BOOL)
						pVal = pVal == "true";
					this.pu.setPref(pName, pVal);
				},
				this
			);
	},

	// Clicking options management
	// Export/import:
	exportSets: function() {
		var file = this.pickFile(this.ut.getLocalized("exportSets"), true, "js");
		if(!file)
			return;
		this.ps.prefsFile.copyTo(file.parent, file.leafName);
		this.backupsDir = file.parent.path;
	},
	importSets: function() {
		var file = this.pickFile(this.ut.getLocalized("importSets"), false, "js");
		if(!file)
			return;
		if(!this.checkPrefsFile(file)) {
			this.ut.alertEx(
				this.ut.getLocalized("importErrorTitle"),
				this.ut.getLocalized("invalidConfigFile")
			);
			return;
		}
		this.ps.moveFiles(this.ps.prefsFile, this.ps.names.beforeImport);
		file.copyTo(this.ps.prefsDir, this.ps.prefsFileName + ".js");
		this.ps.reloadSettings(true);
		this.backupsDir = file.parent.path;
	},

	// Export/import utils:
	pickFile: function(pTitle, modeSave, ext) {
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
		fp.defaultString = this.ps.prefsFileName + (modeSave ? this.date : "") + "." + ext;
		fp.defaultExtension = "js";
		fp.appendFilter(this.ut.getLocalized("hcPrefsFiles"), "handyclicks_prefs*." + ext);
		fp.appendFilter(this.ut.getLocalized(ext + "Files"), "*." + ext);
		fp.appendFilters(fp.filterAll);
		var bDir = this.backupsDir;
		if(bDir)
			fp.displayDirectory = bDir;
		fp.init(window, pTitle, fp[modeSave ? "modeSave" : "modeOpen"]);
		if(fp.show() == fp.returnCancel)
			return null;
		var file = fp.file;
		if(modeSave && file.exists())
			file.remove(true);
		return file;
	},
	get backupsDir() {
		var path = this.pu.pref("sets.backupsDir");
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try { file.initWithPath(path); }
		catch(e) { return null; }
		return file.exists() ? file : null;
	},
	set backupsDir(path) {
		this.pu.pref("sets.backupsDir", path);
	},
	get date() {
		return new Date().toLocaleFormat("_%Y-%m-%d_%H-%M");
	},
	checkPrefsFile: function(file) {
		var data = this.readFromFile(file);
		var _data = data;
		if(data.substr(0, 2) != "//")
			return false;
		var hc = /^var handyClicks[\w$]+\s*=.*$/mg;
		if(!hc.test(data))
			return false;
		data = data.replace(hc, ""); // Replace handyClicks* vars
		data = data.replace(/^(?:\/\/[^\n\r]+[\n\r]+)+/g, ""); // Replace comments
		if(/\/\/|\/\*|\*\//.test(data)) // No other comments
			return false;
		data = data.replace(/"[^"]*"/g, "_dummy_"); // Replace strings
		if(/\Wvar\s+/.test(data)) // No other vars
			return false;
		if(/['"()=]/.test(data))
			return false;
		if(/\W(?:[Ff]unction|eval|Components)\W/.test(data))
			return false;
		this.ps._savedStr = _data; // Update cache - see this.ps.saveSettings()
		return true;
	},
	readFromFile: function(file) { // Not for UTF-8!
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		var sis = Components.classes["@mozilla.org/scriptableinputstream;1"]
			.createInstance(Components.interfaces.nsIScriptableInputStream);
		fis.init(file, -1, 0, 0);
		sis.init(fis);
		var data = sis.read(sis.available());
		sis.close();
		fis.close();
		return data;
	}
};
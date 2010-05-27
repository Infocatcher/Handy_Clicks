var handyClicksFuncs = {
	isVoidURI: function(uri) {
		uri = (uri || "").replace(/(?:\s|%20)+/g, " ");
		return /^javascript: *(?:|\/\/|void *(?: +0|\( *0 *\))) *;? *$/i.test(uri);
	},
	isJSURI: function(uri) {
		return typeof uri == "string" && /^javascript:/i.test(uri);
	},
	isDummyURI: function(item, uri) {
		uri = uri || this.getItemURI(item);
		var doc = item.ownerDocument;
		var loc = doc.location.href.replace(/#.*$/, "");
		if(uri.indexOf(loc) != 0)
			return false;
		var _uri = uri.substr(loc.length);
		if(_uri == "" && item.getAttribute && !item.getAttribute("href")) // <a href="">
			return true;
		if(_uri.indexOf("#") != 0)
			return false;
		var anchor = _uri.substr(1);
		return !anchor || (!doc.getElementById(anchor) && !doc.getElementsByName(anchor).length);
	},

	copyItemText: function(e, closePopups) {
		var text = this.getItemText();
		if(text) {
			text = Array.concat(text);
			this.ut.copyStr(text.join("\n"));
			this.ui.blinkNode();
		}
		if(closePopups)
			this.hc.closeMenus();
	},
	copyItemLink: function(e, closePopups) {
		var link = this.getItemURI() || "";
		if(link) {
			link = Array.concat(link);
			if(this.pu.pref("funcs.decodeURIs"))
				link = link.map(this.losslessDecodeURI, this);
			this.ut.copyStr(link.join("\n"));
			this.ui.blinkNode();
		}
		if(closePopups)
			this.hc.closeMenus();
	},
	getItemText: function(it, e, noTrim) {
		it = it || this.hc.item;
		e = e || this.hc.copyOfEvent;
		var text = this.hc.itemType == "tabbar"
			? this.forEachTab(this.getTabText)
			: this.hc.itemType == "ext_mulipletabs"
				? Array.map(it, this.getTabText, this)
				: it.textContent || it.label || it.alt || it.title || it.value
					|| (
						it.getAttribute
						&& (it.getAttribute("label") || it.getAttribute("value"))
					)
					|| this.getTreeText(it, e)
					|| "";
		return noTrim ? text : this.trimStr(text);
	},
	getTreeText: function(it, e) {
		var ln = it.localName;
		return ln && ln.toLowerCase() == "treechildren"
			? this.hc.getTreeInfo(it, e, "title")
			: "";
	},
	getItemURI: function(it, itemType, noTrim) {
		it = it || this.hc.item;
		var uri = "";
		switch(itemType || this.hc.itemType) {
			case "link":
				uri = this.getLinkURI(it);
			break;
			case "img":
				uri = it.src;
			break;
			case "bookmark":
			case "historyItem":
				uri = this.hc.getBookmarkURI(it);
			break;
			case "tab":
				uri = this.getTabURI(it);
			break;
			case "ext_mulipletabs":
				uri = Array.map(it, this.getTabURI, this); //.join("\n");
			break;
			case "tabbar":
				uri = this.forEachTab(this.getTabURI); //.join("\n");
			break;
			default: // Support for custom types
				uri = this.getLinkURI(it)
					|| it.src
					|| this.hc.getBookmarkURI(it)
					|| this.getTabURI(it);
		}

		var isArr = this.ut.isArray(uri);
		uri = Array.concat(uri).map(
			function(s) {
				if(this.isJSURI(s))
					try { return decodeURI(s); }
					catch(e) {}
				return s;
			},
			this
		);
		if(!isArr)
			uri = uri.toString();
		return noTrim ? uri : this.trimStr(uri);
	},
	trimStr: function(s) {
		if(!this.pu.pref("funcs.trimStrings"))
			return s;
		var isArr = this.ut.isArray(s);
		s = Array.concat(s)
			.map(this.ut.safeToString, this.ut)
			.map(this.ut.trim, this.ut);
		return isArr ? s : s.toString();
	},
	getLinkURI: function(it) {
		const ns = "http://www.w3.org/1999/xlink";
		return it.hasAttributeNS(ns, "href")
			? makeURLAbsolute(it.baseURI, it.getAttributeNS(ns, "href")) // See chrome://browser/content/utilityOverlay.js
			// Looks like wrapper error with chrome://global/content/bindings/text.xml#text-link binding
			// on "content" pages (e.g. chrome://global/content/console.xul)
			: it.href || it.getAttribute("href")
				|| this.ut.getProperty(it, "repObject", "href"); // Firebug
	},
	getTabURI: function(tab) {
		return "linkedBrowser" in tab
			? tab.linkedBrowser.contentDocument.location.href
			: "";
	},
	getTabText: function(tab) {
		return tab.label || tab.getAttribute("label");
	},
	forEachTab: function(fnc, _this, tbr) {
		return Array.map(
			(tbr || this.hc.getTabBrowser(true)).tabContainer.childNodes,
			fnc,
			_this || this
		);
	},

	// Open URI in...
	openURIInCurrentTab: function(e, refererPolicy, closePopups, uri) {
		uri = uri || this.getItemURI(this.hc.item);
		if(this.testForLinkFeatures(e, this.hc.item, uri, false, false, refererPolicy, undefined, "cur"))
			return;
		this.hc.getTabBrowser().loadURI(uri, this.getRefererForItem(refererPolicy));
		if(closePopups)
			this.hc.closeMenus();
	},
	relativeIndex: 0,
	openURIInTab: function(e, loadInBackground, loadJSInBackground, refererPolicy, moveTo, closePopups, winRestriction) {
		var tbr = this.hc.getTabBrowser(true);
		if(moveTo == "relative") {
			var tabCont = tbr.tabContainer;
			tabCont.__handyClicks__resetRelativeIndex = false;
		}
		var tab = this._openURIInTab(e, null, null, loadInBackground, loadJSInBackground, refererPolicy, moveTo, winRestriction);
		if(closePopups)
			this.hc.closeMenus();
		if(!tab || !moveTo)
			return;
		var curTab = tbr.selectedTab;
		var curInd = curTab._tPos, ind = 0;
		if(this.ut.fxVersion == 1.5 && moveTo == "relative")
			moveTo = "after"; // Tab* events is not supported
		switch(moveTo) {
			case "first":    ind = 0;                             break;
			case "before":   ind = curInd;                        break;
			case "after":    ind = curInd + 1;                    break;
			case "last":     ind = tbr.browsers.length;           break;
			case "relative": ind = curInd + ++this.relativeIndex; break;
			default:
				this.ut._err(new Error("openURIInTab -> invalid moveTo argument: " + moveTo));
				return;
		}
		if(
			"TreeStyleTabService" in window
			&& (moveTo == "after" || moveTo == "relative")
			&& ind == tbr.browsers.length - 1
		)
			tbr.moveTabTo(tab, 0); // Fix bug for last tab moving
		tbr.moveTabTo(tab, ind);

		if(moveTo != "relative")
			return;
		tabCont.__handyClicks__resetRelativeIndex = true;
		if(tabCont.__handyClicks__listeners)
			return;
		tabCont.__handyClicks__listeners = true;
		var _this = this;
		var _resetRelativeIndex = function(e) {
			if(!tabCont.__handyClicks__resetRelativeIndex)
				return;
			_this.relativeIndex = 0;
		};
		tabCont.addEventListener("TabClose", _resetRelativeIndex, true);
		tabCont.addEventListener("TabSelect", _resetRelativeIndex, true);

		this.cs.registerNodeCleanup(
			tbr,
			function(rri) {
				this.__handyClicks__listeners = false;
				this.removeEventListener("TabClose", rri, true);
				this.removeEventListener("TabSelect", rri, true);
			},
			tabCont, [_resetRelativeIndex]
		);
	},
	_openURIInTab: function(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy, moveTo, winRestriction) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getItemURI(item);
		if(this.testForLinkFeatures(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy, winRestriction, "tab"))
			return null;
		var tbr = this.hc.getTabBrowser(true);

		// Open a new tab as a child of the current tab (Tree Style Tab)
		// http://piro.sakura.ne.jp/xul/_treestyletab.html.en#api
		if(!moveTo && !this.ut.isChromeDoc(item.ownerDocument) && "TreeStyleTabService" in window)
			TreeStyleTabService.readyToOpenChildTab(tbr.selectedTab);

		var tab = tbr.addTab(uri, this.getRefererForItem(refererPolicy, false, item));
		if(!loadInBackground)
			tbr.selectedTab = tab;
		return tab;
	},
	testForLinkFeatures: function(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy, winRestriction, target) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getItemURI(item);
		if(
			this.testForHighlander(uri)
			|| this.loadJavaScriptLink(e, item, uri, loadJSInBackground, refererPolicy, winRestriction, target)
			|| this.testForFileLink(uri, refererPolicy)
		)
			return true;
		return false;
	},
	testForHighlander: function(uri) {
		// Highlander ( https://addons.mozilla.org/firefox/addon/4086 )
		if("Highlander" in window) {
			var tab = Highlander.findTabForURI(makeURI(uri)); // chrome://global/content/contentAreaUtils.js
			if(tab) {
				Highlander.selectTab(tab);
				return true;
			}
		}
		return false;
	},
	loadJavaScriptLink: function(e, item, uri, loadJSInBackground, refererPolicy, winRestriction, target) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getItemURI(item);

		var voidURI = this.isVoidURI(uri);
		if(!voidURI && this.isJSURI(uri)) {
			this.loadNotVoidJavaScriptLink(e, item, uri, loadJSInBackground, refererPolicy, winRestriction, target);
			return true;
		}
		else if(voidURI || this.isDummyURI(item, uri) || target == "cur" && this.hasHandlers(item)) {
			this.loadVoidLinkWithHandler(e, item, loadJSInBackground, refererPolicy, winRestriction, target);
			return true;
		}
		return false;
	},
	loadVoidLinkWithHandler: function(e, item, loadJSInBackground, refererPolicy, winRestriction, target) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;

		var evts = this.hc.createMouseEvents(e, item, ["mousedown", "mouseup", "click"], 0);
		var loadLink = this.ut.bind(function() {
			var origPrefs = this.setPrefs(
				this.getOpenLinksPrefs(target, loadJSInBackground, refererPolicy, winRestriction, false /* winOpenFix */)
			);
			evts();
			this.restorePrefs(origPrefs);
		}, this);

		var load = this.pu.pref("funcs.loadVoidLinksWithHandlers");
		if(this.pu.pref("funcs.notifyVoidLinksWithHandlers"))
			this.ut.notify(
				this.ut.getLocalized("voidLinkWithHandler").replace(/\s*%h/, this.getItemHandlers(item))
					+ (load ? "" : this.ut.getLocalized("clickForOpen")),
				this.ut.getLocalized("title"),
				!load && loadLink
			);
		if(load)
			loadLink();
	},
	hasHandlers: function(it) {
		it = it || this.hc.item;
		if(!it)
			return false;
		it = it.wrappedJSObject;
		if(!it)
			return false;
		return ["onmousedown", "onmouseup", "onclick"].some(
			function(h) {
				return h in it;
			}
		);
	},
	getItemHandlers: function(item) {
		item = (item || this.hc.item).wrappedJSObject;
		var hnds = ["onmousedown", "onmouseup", "onclick"].filter(
			function(h) {
				return h in item;
			}
		);
		return hnds.length ? " (" + hnds.join(", ") + ")" : "";
	},
	loadNotVoidJavaScriptLink: function(e, item, uri, loadJSInBackground, refererPolicy, winRestriction, target) {
		item = item || this.hc.item;
		uri = uri || this.getItemURI(item);

		var loadLink = this.ut.bind(function() {
			var origPrefs = this.setPrefs(
				this.getOpenLinksPrefs(target, loadJSInBackground, refererPolicy, winRestriction, true /* winOpenFix */)
			);

			var oDoc = item.ownerDocument;
			if(this.ut.isChromeDoc(oDoc))
				this.hc.getTabBrowser().loadURI(uri); // bookmarklets
			else
				oDoc.location.href = uri;

			//this.restorePrefs(origPrefs);
			setTimeout(function(_this) {
				_this.restorePrefs(origPrefs);
			}, 5, this);
		}, this);

		var load = this.pu.pref("funcs.loadJavaScriptLinks");
		if(this.pu.pref("funcs.notifyJavaScriptLinks"))
			this.ut.notify(
				this.ut.getLocalized("javaScriptLink")
					+ (load ? "" : this.ut.getLocalized("clickForOpen")),
				this.ut.getLocalized("title"),
				!load && loadLink
			);
		if(load)
			loadLink();
	},
	testForFileLink: function(uri, refererPolicy) {
		uri = uri || this.getItemURI(this.hc.item);
		var filesPolicy = this.pu.pref("funcs.filesLinksPolicy");
		if(filesPolicy == -1)
			return false;
		var regexp = this.pu.pref("funcs.filesLinksMask");
		if(!regexp)
			return false;
		try {
			var _regexp = new RegExp(regexp, "i");
		}
		catch(e) {
			this.ut.alert(
				this.ut.getLocalized("errorTitle"),
				this.ut.getLocalized("RegExpError").replace("%r", regexp).replace("%e", e)
			);
			return false;
		}
		if(!_regexp.test(uri))
			return false;
		if(filesPolicy == 0)
			this.hc.showPopupOnItem();
		else
			this.hc.getTabBrowser().loadURI(uri, this.getRefererForItem(refererPolicy));
		return true;
	},
	openURIInWindow: function(e, loadInBackground, refererPolicy, moveTo, closePopups) {
		var win = this._openURIInWindow(e, null, null, loadInBackground, refererPolicy);
		if(closePopups)
			this.hc.closeMenus();
		if(!win || !moveTo)
			return;
		var sal = screen.availLeft, sat = screen.availTop;
		var saw = screen.availWidth, sah = screen.availHeight;
		var xCur, yCur, wCur, hCur;
		var xNew, yNew, wNew, hNew;
		switch(moveTo) {
			case "top":
				xCur = sal,         yCur = sat + sah/2;
				wCur = saw,         hCur = sah/2;

				xNew = sal,         yNew = sat;
				wNew = saw,         hNew = sah/2;
			break;
			case "right":
				xCur = sal,         yCur = sat;
				wCur = saw/2,       hCur = sah;

				xNew = sal + saw/2, yNew = sat;
				wNew = saw/2,       hNew = sah;
			break;
			case "bottom":
				xCur = sal,         yCur = sat;
				wCur = saw,         hCur = sah/2;

				xNew = sal,         yNew = sat + sah/2;
				wNew = saw,         hNew = sah/2;
			break;
			case "left":
				xCur = sal + saw/2, yCur = sat;
				wCur = saw/2,       hCur = sah;

				xNew = sal,         yNew = sat;
				wNew = saw/2,       hNew = sah;
			break;
			case "sub":
				xNew = window.screenX,    yNew = window.screenY;
				wNew = window.outerWidth, hNew = window.outerHeight;
			break;
			default:
				this.ut._err(new Error("openURIInWindow -> invalid moveTo argument: " + moveTo));
				return;
		}
		if(xCur !== undefined && yCur !== undefined)
			window.moveTo(xCur, yCur);
		if(wCur !== undefined && hCur !== undefined)
			window.resizeTo(wCur, hCur);
		this.initWindowMoving(win, xNew, yNew, wNew, hNew);
	},
	_openURIInWindow: function(e, item, uri, loadInBackground, refererPolicy) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getItemURI(item);
		if(this.testForLinkFeatures(e, item, uri, loadInBackground, false /* loadJSInBackground */, refererPolicy, undefined, "win"))
			return null;
		var win = window.openDialog(
			getBrowserURL(),
			"_blank",
			"chrome,all,dialog=no" + (loadInBackground ? ",alwaysLowered" : ""), // Thanks to All-in-One Gestures!
			uri, null,
			this.getRefererForItem(refererPolicy), null, false
		);
		if(loadInBackground)
			this.initZLevelRestoring(win);
		return win;
	},
	get winEvt() {
		return this.ut.fxVersion >= 3.7 ? "load" : "resize";
	},
	initZLevelRestoring: function(win) {
		var pw = window;
		var _this = this;
		win.addEventListener(
			this.winEvt,
			function _rs(e) {
				win.removeEventListener(e.type, _rs, false);
				setTimeout(function() {
					var fe = pw.document.commandDispatcher.focusedElement;
					_this.restoreZLevel(win);
					pw.focus();
					if(fe)
						fe.focus();
				}, 5);
			},
			false
		);
	},
	initWindowMoving: function(win, x, y, w, h) {
		win.addEventListener(
			this.winEvt,
			function _rs(e) {
				win.removeEventListener(e.type, _rs, false);
				win.moveTo(x, y);
				win.resizeTo(w, h);
			},
			false
		);
	},
	restoreZLevel: function(win) {
		var ci = Components.interfaces;
		var xulWin = win.QueryInterface(ci.nsIInterfaceRequestor)
			.getInterface(ci.nsIWebNavigation)
			.QueryInterface(ci.nsIDocShellTreeItem)
			.treeOwner
			.QueryInterface(ci.nsIInterfaceRequestor)
			.getInterface(ci.nsIXULWindow);
		xulWin.zLevel = xulWin.normalZ;
	},

	openURIInSidebar: function(e, closePopups, ttl, uri) {
		var item = this.hc.item;
		ttl = ttl || this.getItemText(item);
		uri = uri || this.getItemURI(item);
		if(uri && !this.isVoidURI(uri))
			openWebPanel(ttl, uri); //~ todo: refererPolicy ?
		if(closePopups)
			this.hc.closeMenus();
	},
	downloadWithFlashGot: function(e, item) {
		if(!("gFlashGot" in window)) {
			this.ut._warn(new Error("Missing FlashGot extension ( https://addons.mozilla.org/firefox/addon/220 )"));
			return;
		}
		document.popupNode = item || this.hc.item;
		gFlashGot.downloadPopupLink();
	},
	openURIInSplitBrowser: function(e, position, closePopups, uri) {
		if(!("SplitBrowser" in window)) {
			this.ut._warn(new Error("Missing Split Browser extension ( https://addons.mozilla.org/firefox/addon/4287 )"));
			return;
		}
		position = (position || "bottom").toUpperCase();
		uri = uri || this.getItemURI(this.hc.item);
		SplitBrowser.addSubBrowser(uri, null, SplitBrowser["POSITION_" + position]);
		if(closePopups)
			this.hc.closeMenus();
	},

	// Generated popup:
	createPopup: function(items) {
		if(typeof items == "xml")
			return this.getPopup(items);
		return this.appendItems(this.getPopup(), items);
	},
	getPopup: function(xml) {
		var pSet = this.$("mainPopupSet");
		const id = "handyClicks-generatedPopup";
		var popup = this.e(id);
		popup && pSet.removeChild(popup);
		popup = xml || <menupopup xmlns={this.ut.XULNS} />;
		popup.@id = id;
		popup.@tooltip = "handyClicks-tooltip";
		return pSet.appendChild(this.ut.parseFromXML(popup));
	},
	appendItems: function(parent, items) {
		items.forEach(function(item) {
			this.appendItem(parent, item);
		}, this);
		return parent;
	},
	appendItem: function(parent, item) {
		var tag = this.ut.getOwnProperty(item, "tagName");
		delete item.tagName;
		var childs = this.ut.getOwnProperty(item, "childNodes");
		delete item.childNodes;

		var node = parent.appendChild(document.createElement(tag));
		var type, pName;
		for(var rawName in item) {
			if(!/^(attr|prop)_(.+)$/.test(rawName))
				continue;
			type = RegExp.$1;
			pName = RegExp.$2;
			if(type == "attr")
				node.setAttribute(pName, item[rawName]);
			else
				node[pName] = item[rawName];
		}
		if(this.ut.isArray(childs))
			this.appendItems(node, childs);
	},

	showGeneratedPopup: function(items) {
		var popup = this.createPopup(items);
		this.hc.showPopupOnItem(popup);
		this.ut.fixIconsSize(popup);
		return popup;
	},

	showOpenURIWithAppsPopup: function(items, checkFiles) {
		var uri = this.getItemURI();
		if(!uri) {
			this.ut._err(new Error("Can't get URI of item (" + this.hc.itemType + ")"));
			return;
		}
		var uris = Array.concat(uri).map(this.losslessDecodeURI, this);
		this.addAppsProps(items, uris, checkFiles);
		this.addEditItem(items);
		var popup = this.showGeneratedPopup(items);
		popup.setAttribute("oncommand", "handyClicksFuncs.openUriWithApp(event, this);");
		popup.hc_uri = uri;
	},
	addAppsProps: function(items, uris, checkFiles) {
		items.forEach(function(item) {
			this.addAppProps(item, uris, checkFiles);
		}, this);
	},
	addAppProps: function(item, uris, checkFiles) {
		var childs = this.ut.getOwnProperty(item, "childNodes");
		if(this.ut.isArray(childs))
			this.addAppsProps(childs, uris, checkFiles);
		var path = this.ut.getOwnProperty(item, "prop_hc_path");
		if(!path)
			return;
		var icon = this.ut.getOwnProperty(item, "prop_hc_icon");
		delete item.prop_hc_icon;
		var img = this.ut.getOwnProperty(item, "prop_hc_image");
		delete item.prop_hc_image;

		const ttBase = "attr_" + this.ui.tooltipAttrBase;
		var n = 0;

		var file = this.ut.getLocalFile(path);
		path = file ? file.path : path;
		item.prop_className = (item.hasOwnProperty("prop_className") ? item.prop_className + " " : "")
			+ "menuitem-iconic";
		if(checkFiles && (!file || !file.exists()/* || !file.isExecutable()*/)) {
			// https://bugzilla.mozilla.org/show_bug.cgi?id=322865
			item.prop_className += " handyClicks-invalidPath";
			item["attr_" + this.ui.tooltipAttrClass + "0"] = "handyClicks-invalidPathTip";
		}
		item.attr_image = this.getFileURI(this.ut.getLocalPath(img))
			|| "moz-icon:file://" + (this.ut.getLocalPath(icon) || path).replace(/\\/g, "/") + "?size=16";
		item[ttBase + n++] = path;
		item.prop_hc_path = path;

		var args = this.ut.getOwnProperty(item, "prop_hc_args");
		if(this.ut.isArray(args))
			for(var j = 0, len = args.length; j < len; j++)
				item[ttBase + n++] = args[j];
		var addNums = uris.length > 1;
		uris.forEach(
			function(uri, indx) {
				item[ttBase + n++] = (addNums ? (indx + 1) + ". " : "") + uri;
			}
		);
	},

	addEditItem: function(items) {
		var cmd = "handyClicksFuncs.openEditorForLastEvent();";
		var label = this.ut.getLocalized("edit");
		var accesskey = this.ut.getLocalized("editAccesskey");
		if(typeof items == "xml") {
			items.lastChild += <menuseparator xmlns={this.ut.XULNS} />;
			items.lastChild += <menuitem xmlns={this.ut.XULNS}
				oncommand={cmd}
				label={label}
				accesskey={accesskey}
			/>;
			return;
		}
		if("appendChild" in items) {
			items.appendChild(this.ut.parseFromXML(
				<menuseparator xmlns={this.ut.XULNS} />
			));
			items.appendChild(this.ut.parseFromXML(
				<menuitem xmlns={this.ut.XULNS}
					oncommand={cmd}
					label={label}
					accesskey={accesskey}
				/>
			));
			return;
		}
		items.push(
			{ tagName: "menuseparator" },
			{
				tagName: "menuitem",
				attr_oncommand: cmd,
				attr_label: label,
				attr_accesskey: accesskey
			}
		);
	},
	openEditorForLastEvent: function() {
		this.wu.openEditorEx(
			null, "shortcut",
			this.ps.getEvtStr(this.hc.lastEvent),
			this.hc.lastAll ? "$all" : this.hc.lastItemType,
			this.hc.isDeleyed, "code", null
		);
	},

	getFileURI: function(path) {
		if(!path || /^\w{2,}:\/\//.test(path)) // Has protocol
			return path;
		return "file://" + path.replace(/\\/g, "/");
	},

	get defaultCharset() { // thanks to IE Tab!
		delete this.defaultCharset;
		return this.defaultCharset = this.ut.getStr("chrome://global-platform/locale/intl.properties", "intl.charset.default");
	},
	get charset() {
		var charset = "";
		if(this.pu.pref("funcs.convertURIs")) {
			charset = this.pu.pref("funcs.convertURIsCharset");
			if(!charset) {
				charset = this.pu.getPref("intl.charset.default");
				if(!charset || charset.indexOf("chrome://") == 0)
					charset = this.defaultCharset;
			}
		}
		return charset;
	},
	convertStrFromUnicode: function(str) {
		var charset = this.charset;
		if(!charset)
			return str;
		this.ut._log("convertStrFromUnicode -> charset -> " + charset);
		var suc = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		suc.charset = charset;
		try {
			str = decodeURIComponent(str); // to UTF-8
		}
		catch(e) { // does not work in fx 1.5
			str = suc.ConvertToUnicode(unescape(str)); // Thanks to IE Tab!
			str = decodeURI(str);
		}
		return suc.ConvertFromUnicode(str);
	},
	openUriWithApp: function(e, popup) {
		var tar = e.target;
		if(!tar.hasOwnProperty("hc_path"))
			return;
		var args = tar.hc_args || [];
		//args.push(popup.hc_uri);
		var uris = Array.concat(popup.hc_uri).map(this.convertStrFromUnicode, this);
		this.ut.startProcess(tar.hc_path, Array.concat(args, uris));
	},
	losslessDecodeURI: function(value) {
		if(!value)
			return "";
		// chrome://browser/content/browser.js, function losslessDecodeURI() in Firefox 3.0+

		// Try to decode as UTF-8 if there's no encoding sequence that we would break.
		if(!/%25(?:3B|2F|3F|3A|40|26|3D|2B|24|2C|23)/i.test(value))
			try {
				value = decodeURI(value)
					// 1. decodeURI decodes %25 to %, which creates unintended
					//    encoding sequences. Re-encode it, unless it's part of
					//    a sequence that survived decodeURI, i.e. one for:
					//    ';', '/', '?', ':', '@', '&', '=', '+', '$', ',', '#'
					//    (RFC 3987 section 3.2)
					// 2. Re-encode whitespace so that it doesn't get eaten away
					//    by the location bar (bug 410726).
					.replace(/%(?!3B|2F|3F|3A|40|26|3D|2B|24|2C|23)|[\r\n\t]/ig, encodeURIComponent);
			} catch (e) {}

		// Encode invisible characters (soft hyphen, zero-width space, BOM,
		// line and paragraph separator, word joiner, invisible times,
		// invisible separator, object replacement character) (bug 452979)
		value = value.replace(/[\v\x0c\x1c\x1d\x1e\x1f\u00ad\u200b\ufeff\u2028\u2029\u2060\u2062\u2063\ufffc]/g, encodeURIComponent);

		// Encode bidirectional formatting characters.
		// (RFC 3987 sections 3.2 and 4.1 paragraph 6)
		value = value.replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e]/g, encodeURIComponent);
		return value;
	},
	getOpenLinksPrefs: function(target /* "cur", "win" or "tab" */, bg, refererPolicy, winRestriction, winOpenFix) {
		return {
			"browser.tabs.loadDivertedInBackground": target == "tab" && bg || null,
			"browser.link.open_newwindow.restriction": winRestriction === undefined ? 0 : this.getWinRestriction(winRestriction),
			"browser.link.open_newwindow": target == "cur" && 1 || target == "win" && 2 || target == "tab" && 3,
			"network.http.sendRefererHeader": this.getRefererPolicy(refererPolicy),
			"dom.disable_open_during_load": winOpenFix ? false : null
		};
	},
	getWinRestriction: function(inWin) {
		return inWin === true
			? 1 // Open in new window
			: inWin === -1 // -1 - global value, other - override
				? this.pu.getPref("browser.link.open_newwindow.restriction")
				: inWin;
	},
	setPrefs: function() {
		var origs = { __proto__: null };
		Array.forEach(
			arguments,
			function(prefsObj) {
				for(var p in prefsObj) if(prefsObj.hasOwnProperty(p)) {
					if(prefsObj[p] === null)
						continue;
					origs[p] = this.pu.getPref(p);
					this.pu.setPref(p, prefsObj[p]);
				}
			},
			this
		);
		return origs;
	},
	restorePrefs: function(prefsObj) {
		for(var p in prefsObj)
			this.pu.setPref(p, prefsObj[p]);
	},
	submitForm: function(e, target, loadInBackground, refererPolicy, node) {
		// Thanks to SubmitToTab! ( https://addons.mozilla.org/firefox/addon/483 )
		node = node || this.hc.item;
		node = new XPCNativeWrapper(node, "form", "click()"); // ?
		var form = node.form;
		var origTarget = form.hasAttribute("target") && form.getAttribute("target");
		form.target = target == "cur" ? "" : "_blank";

		var origPrefs = this.setPrefs(
			this.getOpenLinksPrefs(target, loadInBackground, refererPolicy, undefined /* winRestriction */, true /* winOpenFix */)
		);

		this.hc._enabled = false; // Don't stop this "click"
		node.click();
		this.hc._enabled = true;

		this.ut.attribute(form, "target", origTarget, true);
		this.restorePrefs(origPrefs);
	},

	fixTab: function(tab) {
		tab = tab || this.hc.item;
		if(!tab || tab.localName != "tab")
			tab = this.hc.getTabBrowser().selectedTab;
		return tab;
	},
	removeOtherTabs: function(e, tab) {
		tab = this.fixTab(tab);
		this.hc.getTabBrowser().removeAllTabsBut(tab);
	},
	removeAllTabs: function(e) {
		var tbr = this.hc.getTabBrowser();
		var tabs = tbr.tabContainer.childNodes;
		var len = tabs.length;
		if(this.warnAboutClosingTabs(len, tbr))
			for(var i = len - 1; i >= 0; --i)
				tbr.removeTab(tabs[i]);
	},
	removeRightTabs: function(e, tab) {
		tab = this.fixTab(tab);
		var tbr = this.hc.getTabBrowser();
		var tabs = tbr.tabContainer.childNodes;
		var _tabs = [];
		for(var i = tabs.length - 1; i >= 0; --i) {
			if(tabs[i] == tab)
				break;
			_tabs.push(tabs[i]);
		}
		if(this.warnAboutClosingTabs(_tabs.length, tbr))
			_tabs.forEach(tbr.removeTab, tbr);
	},
	removeLeftTabs: function(e, tab) {
		tab = this.fixTab(tab);
		var tbr = this.hc.getTabBrowser();
		var tabs = tbr.tabContainer.childNodes;
		var _tabs = [];
		for(var i = 0, len = tabs.length; i < len; i++) {
			if(tabs[i] == tab)
				break;
			_tabs.push(tabs[i]);
		}
		if(this.warnAboutClosingTabs(_tabs.length, tbr))
			_tabs.forEach(tbr.removeTab, tbr);
	},
	warnAboutClosingTabs: function(tabsToClose, tbr) {
		// Based on code of Firefox 1.5 - 3.0
		// "warnAboutClosingTabs" method in chrome://browser/content/tabbrowser.xml
		tbr = tbr || this.hc.getTabBrowser();
		tabsToClose = typeof tabsToClose == "number"
			? tabsToClose
			: tbr.tabContainer.childNodes.length;
		var reallyClose = true;
		if(tabsToClose <= 1)
			return reallyClose;
		const pref = "browser.tabs.warnOnClose";
		var shouldPrompt = tbr.mPrefs.getBoolPref(pref);
		if(shouldPrompt) {
			var pSvc = this.ut.promptsSvc;
			// default to true: if it were false, we wouldn't get this far
			var warnOnClose = { value: true };
			var bundle = tbr.mStringBundle;
			var messageKey = this.ut.isSeaMonkey
				? "tabs.closeWarning"
				: this.ut.fxVersion == 1.5
					? tabsToClose == 1 ? "tabs.closeWarningOne"    : "tabs.closeWarningMultiple"
					: tabsToClose == 1 ? "tabs.closeWarningOneTab" : "tabs.closeWarningMultipleTabs";
			var closeKey = this.ut.isSeaMonkey
				? "tabs.closeButton"
				: tabsToClose == 1 ? "tabs.closeButtonOne" : "tabs.closeButtonMultiple";
			// focus the window before prompting.
			// this will raise any minimized window, which will
			// make it obvious which window the prompt is for and will
			// solve the problem of windows "obscuring" the prompt.
			// see bug #350299 for more details
			window.focus();
			var buttonPressed = pSvc.confirmEx(window,
				bundle.getString("tabs.closeWarningTitle"),
				bundle.getFormattedString(messageKey, [tabsToClose]),
				  pSvc.BUTTON_POS_0 * pSvc.BUTTON_TITLE_IS_STRING
				+ pSvc.BUTTON_POS_1 * pSvc.BUTTON_TITLE_CANCEL,
				bundle.getString(closeKey),
				null, null,
				bundle.getString("tabs.closeWarningPromptMe"),
				warnOnClose
			);
			reallyClose = buttonPressed == 0;
			// don't set the pref unless they press OK and it's false
			if(reallyClose && !warnOnClose.value)
				tbr.mPrefs.setBoolPref(pref, false);
		}
		return reallyClose;
	},
	removeTab: function(e, tab) {
		tab = this.fixTab(tab);
		this.hc.getTabBrowser().removeTab(tab);
	},
	renameTab: function(e, tab) {
		tab = this.fixTab(tab);
		var doc = tab.linkedBrowser.contentDocument;
		var title = doc.title;
		var lbl = this.ut.prompt(
			this.ut.getLocalized("renameTabTitle"),
			this.ut.getLocalized("tabNewName"),
			title
		);
		const p = "__handyClicks__title";
		if(!(p in tab))
			tab[p] = title;
		if(lbl == null) {
			doc.title = tab[p];
			delete tab[p];
			return;
		}
		doc.title = lbl
		/**
		tab.label = lbl == null
			? tab.linkedBrowser.contentDocument.title
				|| this.hc.getTabBrowser(true).mStringBundle.getString("tabs.untitled")
			: lbl;
		**/
	},
	reloadAllTabs: function(e, skipCache) {
		this.forEachTab(
			function(tab) {
				this.reloadTab(e, skipCache, tab);
			}
		);
	},
	reloadTab: function(e, skipCache, tab) {
		tab = this.fixTab(tab);
		if(this.ensureTabLoaded(tab))
			return;
		var br = tab.linkedBrowser;
		if(skipCache)
			br.reloadWithFlags(nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY | nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);
		else
			br.reload();
	},
	ensureTabLoaded: function(tab) {
		// For BarTab ( https://addons.mozilla.org/firefox/addon/67651 )
		if(tab.getAttribute("ontap") == "true") {
			if("BarTabHandler" in window) {
				BarTabHandler.prototype.loadTab(tab);
				//~ todo: getTabbrowserForTab(tab).BarTabHandler.loadTab(tab);
				return true;
			}
			if("BarTap" in window) {
				BarTap.loadTabContents(tab);
				return true;
			}
		}
		return false;
	},
	stopAllTabsLoading: function(e) {
		this.forEachTab(
			function(tab) {
				this.stopTabLoading(e, tab);
			}
		);
	},
	stopTabLoading: function(e, tab) {
		tab = this.fixTab(tab);
		var br = tab.linkedBrowser;
		br.stop();
	},
	undoCloseTab: function(e) {
		if("undoCloseTab" in window) // Firefox 2.0+
			undoCloseTab(0);
		else if("TMP_ClosedTabs" in window) // Tab Mix Plus
			TMP_ClosedTabs.undoCloseTab();
		else if("gSessionManager" in window) // Old Session Manager
			gSessionManager.undoCloseTab();
	},
	cloneTab: function(e, tab) {
		tab = this.fixTab(tab);
		var tbr = this.hc.getTabBrowser();
		var ind = ++tab._tPos;
		if("duplicateTab" in tbr) // fx 3.0+
			var newTab = tbr.duplicateTab(tab);
		else // Not a real "clone"... Just URI's copy
			var newTab = tbr.addTab(this.getTabURI(tab));
		if("TreeStyleTabService" in window && ind == tbr.browsers.length - 1)
			tbr.moveTabTo(newTab, ind - 1); // Fix bug for last tab moving
		tbr.moveTabTo(newTab, ind);
		tbr.selectedTab = newTab;
	},

	// Multiple Tab Handler extension
	// http://piro.sakura.ne.jp/xul/_multipletab.html.en#api-multipletabs
	mthOk: function() {
		if("MultipleTabService" in window)
			return true;
		else {
			this.ut._warn(new Error(
				"Missing Multiple Tab Handler extension ( https://addons.mozilla.org/firefox/addon/4838 )"
			));
			return false;
		}
	},
	mthCloseTabs: function(e, tabs) {
		this.mthOk() && MultipleTabService.closeTabs(tabs || this.hc.item);
	},
	mthCloseOtherTabs: function(e, tabs) {
		this.mthOk() && MultipleTabService.closeOtherTabs(tabs || this.hc.item);
	},
	mthReloadTabs: function(e, tabs) {
		this.mthOk() && MultipleTabService.reloadTabs(tabs || this.hc.item);
	},
	mthAddBookmarkFor: function(e, tabs) {
		this.mthOk() && MultipleTabService.addBookmarkFor(tabs || this.hc.item);
	},
	mthDuplicateTabs: function(e, tabs) {
		this.mthOk() && MultipleTabService.duplicateTabs(tabs || this.hc.item);
	},
	mthSplitWindowFromTabs: function(e, tabs) {
		this.mthOk() && MultipleTabService.splitWindowFromTabs(tabs || this.hc.item);
	},

	reloadImg: function(e, img) {
		img = img || this.hc.item;
		var src = img.src;
		if(!src)
			return;
		var origStyle = img.hasAttribute("style") && img.getAttribute("style");
		var w = this.getStyle(img, "width");
		var h = this.getStyle(img, "height");
		img.style.setProperty("width", w, "important");
		img.style.setProperty("height", h, "important");
		if(parseInt(w) > 24 || parseInt(h) > 24)
			img.style.setProperty("background", "url(\"" + this.resPath + "loading.gif\") center no-repeat", "important");
		img.setAttribute("src", this.resPath + "spacer.gif"); // transparent gif 1x1
		setTimeout(
			function(_this) {
				img.setAttribute("src", src);
				img.addEventListener(
					"load",
					function _l() {
						img.removeEventListener("load", _l, false);
						_this.ut.attribute(img, "style", origStyle, true);
					},
					false
				);
			},
			0, this
		);
	},
	get resPath() {
		delete this.resPath;
		return this.resPath = this.ut.fxVersion < 3
			? "chrome://handyclicks/content/res/"
			: "resource://handyclicks-content/";
	},
	getStyle: function(item, propName) {
		item = item || this.hc.item;
		return item.ownerDocument.defaultView.getComputedStyle(item, "")[propName];
	},
	openSimilarLinksInTabs: function(e, refererPolicy, a) {
		a = a || this.hc.item;
		var term = this.ut.innerXML(a);
		if(!term) {
			this.ut._err(new Error("openSimilarLinksInTabs() is not supported: can't serialize a.childNodes to string"));
			return;
		}
		var ps = this.ut.promptsSvc;
		var onlyUnvisited = { value: false };
		// https://bugzilla.mozilla.org/show_bug.cgi?id=345067
		// confirmEx always returns 1 if the user closes the window using the close button in the titlebar
		this.ut.fixMinimized();
		var button = ps.confirmEx(
			window, this.ut.getLocalized("title"),
			this.ut.getLocalized("openSimilarLinksConfirm"),
			  ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_0_DEFAULT,
			this.ut.getLocalized("openButton"), "", this.ut.getLocalized("openWithDelaysButton"),
			this.ut.getLocalized("openOnlyVisited"), onlyUnvisited
		);
		if(button == 1)
			return;
		onlyUnvisited = onlyUnvisited.value;
		var useDelays = button == 2;

		// Based on code by Yan ( http://forum.mozilla-russia.org/viewtopic.php?pid=144109#p144109 )
		var hrefs = { __proto__: null };
		var gh = Components.classes["@mozilla.org/browser/global-history;2"]
			.getService(Components.interfaces.nsIGlobalHistory2);
		var onlyVisible = this.pu.pref("funcs.openOnlyVisibleLinks");
		Array.forEach(
			a.ownerDocument.getElementsByTagName(a.localName),
			function(a) {
				var t = this.ut.innerXML(a);
				var h = this.getLinkURI(a);
				if(
					t == term && h && !this.isJSURI(h)
					&& (!onlyUnvisited || !gh.isVisited(makeURI(h))) // chrome://global/content/contentAreaUtils.js
					&& (
						!onlyVisible || this.ut.isElementVisible(a)
						// See https://bugzilla.mozilla.org/show_bug.cgi?id=530985
						|| a.namespaceURI == "http://www.w3.org/2000/svg"
					)
				)
					hrefs[h] = true;
			},
			this
		);

		var tbr = this.hc.getTabBrowser(true);
		var ref = this.getRefererForItem(refererPolicy);

		if("PlacesUIUtils" in window && "_confirmOpenInTabs" in PlacesUIUtils) {
			var count = 0;
			for(var h in hrefs)
				count++;
			if(!PlacesUIUtils._confirmOpenInTabs(count))
				return;
		}

		if("TreeStyleTabService" in window) {
			// Open a new tab as a child of the current tab (Tree Style Tab)
			var _tab = tbr.selectedTab;
			TreeStyleTabService.readyToOpenChildTab(_tab, true);
		}

		if(!useDelays) {
			for(var h in hrefs)
				tbr.addTab(h, ref);
			if("TreeStyleTabService" in window)
				TreeStyleTabService.stopToOpenChildTab(_tab);
			return;
		}
		var delay = this.pu.pref("funcs.multipleTabsOpenDelay") || 0;
		(function delayedOpen() {
			for(var h in hrefs) {
				tbr.addTab(h, ref);
				delete hrefs[h];
				setTimeout(delayedOpen, delay);
				return;
			}
			if("TreeStyleTabService" in window)
				TreeStyleTabService.stopToOpenChildTab(_tab);
		})();
	},
	$void: function(e) {}, // dummy function
	getRefererForItem: function(refPolicy, imgLoading, it) {
		if(refPolicy === undefined)
			refPolicy = -1;
		if(imgLoading === undefined)
			imgLoading = false;
		it = it || this.hc.item;
		var oDoc = it.ownerDocument;
		// Must be undefined for Firefox 3.6+ - see addTab() method in chrome://browser/content/tabbrowser.xml
		if(this.ut.isChromeDoc(oDoc))
			return undefined;
		refPolicy = this.getRefererPolicy(refPolicy);
		// http://kb.mozillazine.org/Network.http.sendRefererHeader
		// 0 - none
		// 1 - for docs
		// 2 - for images and docs
		return (refPolicy == 1 && !imgLoading) || refPolicy == 2
			? makeURI(oDoc.location.href) // chrome://global/content/contentAreaUtils.js
			: undefined;
	},
	getRefererPolicy: function(refPolicy) {
		if(refPolicy === undefined)
			refPolicy = -1;
		return refPolicy == -1
			? this.pu.getPref("network.http.sendRefererHeader")
			: refPolicy;
	},
	showContextMenu: function(e) {
		this.hc.showPopupOnItem();
	},

	__noSuchMethod__: function(meth, args) {
		// Support for old names of methods
		const newMeth = meth
			//= Expires after 2010-05-20:
			.replace(/^(_?)open(?:Uri)?In/, "$1openURIIn") // openIn => openURIIn, openUriIn => openURIIn
			.replace(/^get(\w*)Uri(Of[A-Z]\w*)?$/, "get$1URI$2") // getTabUri => getTabURI, getUriOfItem => getURIOfItem
			.replace(/^get(\w+)OfItem$/, "getItem$1")
			//= Expires after 2010-10-20:
			.replace(/^showOpenUriWithAppsPopup$/, "showOpenURIWithAppsPopup");
		const oName = "handyClicksFuncs";
		if(!(newMeth in this)) {
			var caller = Components.stack.caller;
			throw new Error(
				this.ut.errPrefix + 'Method "' + meth + '" does not exist in "' + oName + '" object',
				caller.filename,
				caller.lineNumber
			);
		}
		this.ut._warn(new Error(
			'Function "' + oName + '.' + meth + '" is deprecated. Use "' + oName + '.' + newMeth + '" instead.'
		));
		return this[newMeth].apply(this, args);
	}
};
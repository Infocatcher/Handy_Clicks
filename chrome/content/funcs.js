var handyClicksFuncs = {
	__proto__: handyClicksGlobals,

	isVoidURI: function(uri) {
		uri = (uri || "").replace(/(?:\s|%20)+/g, " ");
		return /^javascript: *(?:|\/\/|void *(?: +0|\( *0 *\))) *;? *$/i.test(uri);
	},
	isJSURI: function(uri) {
		return typeof uri == "string" && /^javascript:/i.test(uri);
	},
	isDummyURI: function(item, uri) {
		//if(this.hc.itemType != "link")
		//	return false;
		uri = uri || this.getItemURI(item);
		var doc = item.ownerDocument;
		var loc = doc.location.href.replace(/#.*$/, "");
		if(!this.ju.startsWith(uri, loc))
			return false;
		var _uri = uri.substr(loc.length);
		if(_uri == "" && item.getAttribute && item.hasAttribute("href") && !item.getAttribute("href")) // <a href="">
			return true;
		if(_uri.charAt(0) != "#")
			return false;
		var anchor = _uri.substr(1);
		if(!anchor) // <a href="#">
			return true;
		if(anchor.charAt(0) == "!") // site.com/#!... links on JavaScript-based sites like http://twitter.com/
			return false;
		return !doc.getElementById(anchor) && !doc.getElementsByName(anchor).length && 2;
	},

	copyItemText: function(e, closePopups) {
		var text = this.getItemText();
		if(text) {
			text = Array.prototype.concat.call(text);
			this.ut.copyStr(text.join(this.io.lineBreak), this.getSourceDocument());
			this.ui.blinkNode();
		}
		if(closePopups)
			this.hc.closeMenus();
	},
	copyItemLink: function(e, closePopups) {
		var link = this.getItemURI() || "";
		if(link) {
			link = Array.prototype.concat.call(link);
			if(this.pu.get("funcs.decodeURIs"))
				link = link.map(this.decodeURI, this);
			this.ut.copyStr(link.join(this.io.lineBreak), this.getSourceDocument());
			this.ui.blinkNode();
		}
		if(closePopups)
			this.hc.closeMenus();
	},
	getSourceDocument: function(node) {
		var items = node || this.hc.item;
		var privateDoc;
		items && Array.prototype.some.call(items, function(node) {
			if(
				node.localName == "tab"
				&& "linkedBrowser" in node
				&& "PrivateBrowsingUtils" in window // Firefox 20.0+
				&& node.linkedBrowser.contentWindow
				&& PrivateBrowsingUtils.isWindowPrivate(node.linkedBrowser.contentWindow)
			)
				return privateDoc = node.linkedBrowser.contentDocument;
			return false;
		});
		// This should be better in most (?) cases...
		// Like https://addons.mozilla.org/addon/private-tab/
		return privateDoc || content && content.document || document;
	},
	getItemText: function(it, itemType, e, noTrim) {
		it = it || this.hc.item;
		itemType = itemType || this.hc.itemType;
		e = e || this.hc.event;
		if(typeof itemType == "object") { //= Added: 2014-02-03
			this.ut._deprecated(
				"handyClicksFuncs.getItemText(item, event, noTrim) arguments is deprecated. "
				+ "Use handyClicksFuncs.getItemText(item, itemType, event, noTrim) instead"
			);
			noTrim = e;
			e = itemType || this.hc.event;
		}
		var text = this.getNodeText(it, itemType, e);
		return noTrim ? text : this.trimStr(text);
	},
	getNodeText: function(it, itemType, e) {
		if(itemType == "tabbar")
			return this.mapTabs(this.getTabText);
		if(itemType == "ext_mulipletabs")
			return Array.prototype.map.call(it, this.getTabText, this);
		if(itemType in this.hc.getText && this.ps.isCustomType(itemType)) try {
			return this.hc.getText[itemType].call(this, it, e);
		}
		catch(e) {
			this.hc.customTypeError(e, itemType);
		}
		return it.textContent || it.value || it.label || it.alt || it.title
			|| (it.getAttribute && (it.getAttribute("label") || it.getAttribute("value")))
			|| this.getTreeText(it, e)
			|| "";
	},
	getTreeText: function(it, e) {
		return it.localName == "treechildren"
			? this.hc.getTreeInfo(it, e, "title")
			: "";
	},
	getItemURI: function(it, itemType, e, noTrim) {
		it = it || this.hc.item;
		itemType = itemType || this.hc.itemType;
		if(e !== undefined && typeof e != "object") { //= Added: 2018-12-27
			this.ut._deprecated(
				"handyClicksFuncs.getItemURI(item, event, noTrim) arguments is deprecated. "
				+ "Use handyClicksFuncs.getItemURI(item, itemType, event, noTrim) instead"
			);
			noTrim = e;
			e = this.hc.event;
		}
		e = e || this.hc.event;
		var uri = "";
		switch(itemType) {
			case "link":
				uri = this.getLinkURI(it);
			break;
			case "img":
				uri = it instanceof HTMLCanvasElement
					? it.toDataURL()
					: it.src || it.getAttribute("src");
			break;
			case "bookmark":
			case "historyItem":
				uri = it.getAttribute("targetURI") || this.hc.getBookmarkURI(it, e);
			break;
			case "tab":
				uri = this.getTabURI(it);
			break;
			case "ext_mulipletabs":
				uri = Array.prototype.map.call(it, this.getTabURI, this); //.join("\n");
			break;
			case "tabbar":
				uri = this.mapTabs(this.getTabURI); //.join("\n");
			break;
			default: // Support for custom types
				uri = this.getNodeURI(it, itemType, e);
		}

		var isArr = this.ju.isArray(uri);
		uri = Array.prototype.concat.call(uri).map(
			function(s) {
				if(this.isJSURI(s))
					try { return decodeURI(s); }
					catch(e) { this.ut._err(e); }
				return s;
			},
			this
		);
		if(!isArr)
			uri = uri.toString();
		return noTrim ? uri : this.trimStr(uri);
	},
	getNodeURI: function(it, itemType, e) {
		if(itemType in this.hc.getURI && this.ps.isCustomType(itemType)) try {
			return this.hc.getURI[itemType].call(this, it, e);
		}
		catch(e) {
			this.hc.customTypeError(e, itemType);
		}
		return this.getLinkURI(it)
			|| it.src || it.getAttribute("src")
			|| it instanceof HTMLCanvasElement && it.toDataURL()
			|| it.getAttribute("targetURI")
			|| this.hc.getBookmarkURI(it, e)
			|| this.getTabURI(it);
	},
	trimStr: function(s) {
		if(!this.pu.get("funcs.trimStrings"))
			return s;
		var isArr = this.ju.isArray(s);
		s = Array.prototype.concat.call(s)
			.map(this.safeToString, this)
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
				|| this.ju.getProperty(it, "repObject", "href") // Firebug
				|| this.hc.getCSSEditorURI(it)
				|| this.hc.getWebConsoleURI(it);
	},
	getTabURI: function(tab) {
		return "linkedBrowser" in tab
			? tab.linkedBrowser.currentURI.spec
			: "";
	},
	getTabText: function(tab) {
		return tab.label || tab.getAttribute("label");
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
	openURIInTab: function(e, loadInBackground, loadJSInBackground, refererPolicy, moveTo, closePopups, winRestriction) {
		var tbr = this.hc.getTabBrowser(true);
		var curInd = this.getTabPos(tbr.selectedTab);
		var tab = this._openURIInTab(e, null, null, loadInBackground, loadJSInBackground, refererPolicy, moveTo, winRestriction);
		if(tab && tab.ownerDocument != document)
			moveTo = null;
		if(this.fxVersion == 1.5 && moveTo == "relative")
			moveTo = "after"; // Tab* events aren't supported
		if(tab && moveTo == "relative") {
			var tabCont = tbr.tabContainer;
			var relIndex = "__handyClicks_relativeIndex";
			if(!(relIndex in tabCont))
				tabCont[relIndex] = 0;
			if(!(relIndex in window)) {
				window[relIndex] = true;
				var resetRelIndex = function(e) {
					var tab = e.originalTarget || e.target;
					var tabs = getTabContainer(tab);
					tabs[relIndex] = 0;
				};
				var getTabContainer = function(tab) {
					for(var tabs = tab.parentNode; tabs; tabs = tabs.parentNode)
						if(tabs.localName == "tabs")
							return tabs;
					return null;
				};
				window.addEventListener("TabSelect", resetRelIndex, false);
				window.addEventListener("TabClose", resetRelIndex, false);
				this.rs.registerCleanup(function() {
					window.removeEventListener("TabSelect", resetRelIndex, false);
					window.removeEventListener("TabClose", resetRelIndex, false);
					delete window[relIndex];
					delete gBrowser.tabContainer[relIndex];
				});
			}
		}
		if(closePopups)
			this.hc.closeMenus();
		if(!tab || !moveTo)
			return;
		var ind = 0;
		switch(moveTo) {
			case "first":    ind = 0;                             break;
			case "before":   ind = curInd;                        break;
			case "after":    ind = curInd + 1;                    break;
			case "last":     ind = tbr.browsers.length;           break;
			case "relative": ind = curInd + ++tabCont[relIndex];  break;
			default:
				this.ut._err('openURIInTab: invalid moveTo argument: "' + moveTo + '"');
				return;
		}
		if(
			"TreeStyleTabService" in window
			&& (moveTo == "after" || moveTo == "relative")
			&& ind == tbr.browsers.length - 1
		)
			tbr.moveTabTo(tab, 0); // Fix bug for last tab moving
		tbr.moveTabTo(tab, ind);
	},
	get isOldAddTab() {
		delete this.isOldAddTab;
		return this.isOldAddTab = this.isSeaMonkey
			? this.fxVersion < 4
			: this.fxVersion < 3.6;
	},
	_openURIInTab: function(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy, moveTo, winRestriction) {
		e = e || this.hc.event;
		item = item || this.hc.item;
		uri = uri || this.getItemURI(item);
		if(this.testForLinkFeatures(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy, winRestriction, "tab"))
			return null;

		var win = window;
		var openAsChild = !moveTo && (
			!this.ut.isChromeDoc(item.ownerDocument)
			|| item.ownerDocument.documentURI.substr(0, 34) == "chrome://browser/content/devtools/"
		);
		var relatedToCurrent = openAsChild;
		if(
			"getTopWin" in win
			&& getTopWin.length > 0 // Only in Firefox for now
			&& !win.toolbar.visible // Popup window
			&& this.pu.get("funcs.dontUseTabsInPopupWindows")
		) {
			win = getTopWin(true);
			relatedToCurrent = openAsChild = false;
			win.setTimeout(win.focus, 0);
		}

		var tbr = win.handyClicks.getTabBrowser(true); // D'oh...
		if(openAsChild) {
			// Open a new tab as a child of the current tab (Tree Style Tab)
			// http://piro.sakura.ne.jp/xul/_treestyletab.html.en#api
			if("TreeStyleTabService" in win)
				win.TreeStyleTabService.readyToOpenChildTab(tbr.selectedTab);
			// Tab Kit https://addons.mozilla.org/firefox/addon/tab-kit/
			// TabKit 2nd Edition https://addons.mozilla.org/firefox/addon/tabkit-2nd-edition/
			if("tabkit" in win)
				win.tabkit.addingTab("related");
		}

		var ref = this.getRefererForItem(refererPolicy, false, item);
		if(this.isOldAddTab)
			var tab = tbr.addTab(uri, ref);
		else {
			var tab = tbr.addTab(uri, {
				referrerURI: ref,
				relatedToCurrent: relatedToCurrent
			});
		}
		if(!loadInBackground)
			tbr.selectedTab = tab;

		if(openAsChild && "tabkit" in win)
			win.tabkit.addingTabOver();

		return tab;
	},
	testForLinkFeatures: function(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy, winRestriction, target) {
		e = e || this.hc.event;
		item = item || this.hc.item;
		uri = uri || this.getItemURI(item);
		this.urlSecurityCheck(item.ownerDocument, uri);
		var isImg = this.hc.itemType == "img";
		if(
			this.testForHighlander(uri)
			|| !isImg && this.loadJavaScriptLink(e, item, uri, loadJSInBackground, refererPolicy, winRestriction, target)
			|| !isImg && this.testForFileLink(uri, refererPolicy)
		)
			return true;
		this.hc.beforeLoad(item, uri);
		return false;
	},
	get secMan() {
		delete this.secMan;
		return this.secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
			.getService(Components.interfaces.nsIScriptSecurityManager);
	},
	urlSecurityCheck: function(doc, url) {
		var secMan = this.secMan;
		try {
			if("checkLoadURIStrWithPrincipal" in secMan) // Firefox 3.0+
				secMan.checkLoadURIStrWithPrincipal(doc.nodePrincipal, url, secMan.STANDARD);
			else {
				if(this.ut.isChromeDoc(doc)) {
					this._log("Alloy to open everything from privileged document " + doc.documentURI);
					return;
				}
				secMan.checkLoadURIStr(doc.documentURI, url, secMan.STANDARD);
			}
		}
		catch(e) {
			Components.utils.reportError(e);
			throw new Error("Load of " + url + " from " + doc.documentURI + " denied.");
		}
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
		e = e || this.hc.event;
		item = item || this.hc.item;
		uri = uri || this.getItemURI(item);

		var voidURI = this.isVoidURI(uri);
		if(!voidURI && this.isJSURI(uri)) {
			this.loadNotVoidJavaScriptLink(e, item, uri, loadJSInBackground, refererPolicy, winRestriction, target);
			return true;
		}
		var dummyURI = !voidURI && this.isDummyURI(item, uri);
		if(voidURI || dummyURI || target == "cur" && this.hasHandlers(item)) {
			this.loadVoidLinkWithHandler(e, item, loadJSInBackground, refererPolicy, winRestriction, target, dummyURI);
			return true;
		}
		return false;
	},
	loadVoidLinkWithHandler: function(e, item, loadJSInBackground, refererPolicy, winRestriction, target, dummyURI) {
		e = e || this.hc.event;
		item = item || this.hc.item;

		var isTree = item.localName == "treechildren";
		var evts = this.hc.createMouseEvents(e, item, ["mousedown", "mouseup", "click"], {
			button: isTree ? 1 : 0,
			ctrlKey: isTree ? false : target != "cur" && dummyURI == 2 // Link may be real
		});
		var loadLink = this.ju.bind(function() {
			this.setPrefs(target, loadJSInBackground, refererPolicy, winRestriction, false /* winOpenFix */);

			if(this.pu.get("funcs.workaroundForMousedownImitation")) {
				// https://github.com/Infocatcher/Right_Links/issues/2
				// Tabs becomes not clickable after "mousedown" imitation,
				// so we try to catch "mousedown" before browser's listeners
				var doc = item.ownerDocument;
				var root = this.dwu.getParentForNode(doc, true) || doc.defaultView;
				root.addEventListener("mousedown", function fix(e) {
					root.removeEventListener(e.type, fix, false);
					e.preventDefault();
					//e.stopPropagation();
				}, false);
			}
			evts();

			this.restorePrefs();
		}, this);

		var load = this.pu.get("funcs.loadVoidLinksWithHandlers");
		if(this.pu.get("funcs.notifyVoidLinksWithHandlers")) {
			var msg = this.getLocalized("voidLinkWithHandler").replace(/\s*%h/, this.getItemHandlers(item))
				+ (load ? "" : this.getLocalized("clickForOpen"));
			this.ut.notify(msg, {
				onLeftClick: !load && loadLink
			});
		}
		if(load)
			loadLink();
	},
	get dwu() {
		delete this.dwu;
		return this.dwu = Components.classes["@mozilla.org/inspector/dom-utils;1"]
			.getService(Components.interfaces.inIDOMUtils);
	},
	hasHandlers: function(it) {
		it = this.ut.unwrap(it || this.hc.item);
		return it && ["onmousedown", "onmouseup", "onclick"].some(function(h) {
			return h in it;
		});
	},
	getItemHandlers: function(item) {
		item = this.ut.unwrap(item || this.hc.item);
		var hnds = ["onmousedown", "onmouseup", "onclick"].filter(function(h) {
			return h in item;
		});
		return hnds.length ? " (" + hnds.join(", ") + ")" : "";
	},
	loadNotVoidJavaScriptLink: function(e, item, uri, loadJSInBackground, refererPolicy, winRestriction, target) {
		item = item || this.hc.item;
		uri = uri || this.getItemURI(item);

		var loadLink = this.ju.bind(function() {
			this.setPrefs(target, loadJSInBackground, refererPolicy, winRestriction, true /* winOpenFix */);

			var oDoc = item.ownerDocument;
			if(this.ut.isChromeDoc(oDoc))
				this.hc.getTabBrowser().loadURI(uri); // bookmarklets
			else
				oDoc.location.href = uri;

			this.restorePrefs();
		}, this);

		var load = this.pu.get("funcs.loadJavaScriptLinks");
		if(this.pu.get("funcs.notifyJavaScriptLinks")) {
			var msg = this.getLocalized("javaScriptLink")
				+ (load ? "" : this.getLocalized("clickForOpen"));
			this.ut.notify(msg, {
				onLeftClick: !load && loadLink
			});
		}
		if(load)
			loadLink();
	},
	testForFileLink: function(uri, refererPolicy) {
		var filesPolicy = this.pu.get("funcs.filesLinksPolicy");
		if(filesPolicy == -1)
			return false;
		uri = uri || this.getItemURI(this.hc.item);
		const regexpPref = "funcs.filesLinksMask";
		var regexpStr = this.pu.get(regexpPref);
		if(!regexpStr)
			return false;
		try {
			var regexp = new RegExp(regexpStr, "i");
		}
		catch(e) {
			this.ut._err(e);
			var err = this.getLocalized("RegExpError")
				.replace("%r", regexpStr)
				.replace("%p", this.pu.prefNS + regexpPref)
				.replace("%err", e);
			this.ut.notifyError(err, {
				buttons: {
					$openAboutConfig: function() {
						this.pu.openAboutConfig(this.pu.prefNS + regexpPref);
					},
					$openConsole: this.ut.toErrorConsole
				},
				context: this
			});
			return false;
		}
		if(!regexp.test(uri))
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
				this.ut._err('openURIInWindow: invalid moveTo argument: "' + moveTo + '"');
				return;
		}
		if(xCur !== undefined && yCur !== undefined)
			window.moveTo(xCur, yCur);
		if(wCur !== undefined && hCur !== undefined)
			window.resizeTo(wCur, hCur);
		this.initWindowMoving(win, xNew, yNew, wNew, hNew);
	},
	_openURIInWindow: function(e, item, uri, loadInBackground, refererPolicy) {
		e = e || this.hc.event;
		item = item || this.hc.item;
		uri = uri || this.getItemURI(item);
		if(this.testForLinkFeatures(e, item, uri, loadInBackground, false /* loadJSInBackground */, refererPolicy, undefined, "win"))
			return null;
		var win = window.openDialog(
			getBrowserURL(),
			"_blank",
			"chrome,all,dialog=0" + (loadInBackground ? ",alwaysLowered" : ""), // Thanks to All-in-One Gestures!
			uri, null,
			this.getRefererForItem(refererPolicy), null, false
		);
		if(loadInBackground)
			this.initZLevelRestoring(win);
		return win;
	},
	get winEvt() {
		delete this.winEvt;
		return this.winEvt = this.fxVersion > 3.6 ? "load" : "resize";
	},
	initZLevelRestoring: function(win) {
		var pw = window;
		var _this = this;
		win.addEventListener(this.winEvt, function onLoad(e) {
			win.removeEventListener(e.type, onLoad, false);
			setTimeout(function() {
				var fe = pw.document.commandDispatcher.focusedElement;
				_this.restoreZLevel(win);
				pw.focus();
				fe && fe.focus();
			}, _this.pu.get("funcs.backgroundWindowDelay"));
		}, false);
	},
	initWindowMoving: function(win, x, y, w, h) {
		win.addEventListener(this.winEvt, function onLoad(e) {
			win.removeEventListener(e.type, onLoad, false);
			win.moveTo(x, y);
			win.resizeTo(w, h);
		}, false);
	},
	restoreZLevel: function(win) {
		var xulWin = this.wu.getXulWin(win);
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

	getMissingExtWarning: function(extName, amoId) {
		var arch = "https://web.archive.org/web/2017/";
		return "Missing %name extension (%url)"
			.replace("%name", extName)
			.replace("%url", arch + "https://addons.mozilla.org/firefox/addon/" + amoId);
	},
	downloadWithFlashGot: function(e, item) {
		if(!("gFlashGot" in window)) {
			this.ut._warn(this.getMissingExtWarning("FlashGot", 220));
			return;
		}
		//~ todo: use popup.triggerNode ? (https://bugzilla.mozilla.org/show_bug.cgi?id=383930)
		document.popupNode = item || this.hc.item;
		gFlashGot.downloadPopupLink();
	},
	openURIInSplitBrowser: function(e, position, closePopups, uri) {
		if(!("SplitBrowser" in window)) {
			this.ut._warn(this.getMissingExtWarning("Split Browser", 4287));
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
		if(this.ju.isArray(items))
			return this.appendItems(this.getPopup(), items);
		return this.getPopup(items);
	},
	getPopup: function(popup) {
		if(!popup)
			popup = document.createElement("menupopup");
		else if(typeof popup == "string")
			popup = this.ut.parseXULFromString(popup);
		else if(typeof popup == "xml") // Deprecated
			popup = this.ut.parseFromXML(popup);

		var pSet = this.$("mainPopupSet");
		const popupId = "handyClicks-generatedPopup";
		var oldPopup = this.e(popupId);
		oldPopup && pSet.removeChild(oldPopup);

		this.ut.setAttributes(popup, {
			id: popupId,
			tooltip: "handyClicks-tooltip",
			popupsinherittooltip: "true"
		});
		return pSet.appendChild(popup);
	},
	appendItems: function(parent, items) {
		items.forEach(function(item) {
			this.appendItem(parent, item);
		}, this);
		return parent;
	},
	appendItem: function(parent, item) {
		var tag = this.ju.getOwnProperty(item, "tagName");
		var childs = this.ju.getOwnProperty(item, "childNodes");
		var node = parent.appendChild(document.createElement(tag));
		for(var rawName in item) if(item.hasOwnProperty(rawName)) {
			if(!/^(attr|prop)_(.+)$/.test(rawName))
				continue;
			var type = RegExp.$1;
			var pName = RegExp.$2;
			if(type == "attr")
				node.setAttribute(pName, item[rawName]);
			else
				node[pName] = item[rawName];
		}
		this.ju.isArray(childs) && this.appendItems(node, childs);
	},

	showGeneratedPopup: function(items) {
		var popup = this.createPopup(items);
		this.hc.showPopupOnItem(popup);
		return popup;
	},

	showOpenURIWithAppsPopup: function(items, checkFiles) {
		var uri = this.getItemURI();
		if(!uri) {
			this.ut._err("Can't get URI of item (" + this.hc.itemType + ")");
			return null;
		}
		var uris = Array.prototype.concat.call(uri).map(this.losslessDecodeURI, this);
		this.addAppsProps(items, uris, checkFiles);
		this.addEditItem(items);
		var popup = this.showGeneratedPopup(items);
		popup.setAttribute("oncommand", "handyClicksFuncs.openUriWithApp(event, this);");
		popup.hc_uri = uri;
		return popup;
	},
	addAppsProps: function(items, uris, checkFiles) {
		items.forEach(function(item) {
			this.addAppProps(item, uris, checkFiles);
		}, this);
	},
	addAppProps: function(item, uris, checkFiles) {
		var childs = this.ju.getOwnProperty(item, "childNodes");
		if(this.ju.isArray(childs))
			this.addAppsProps(childs, uris, checkFiles);
		var path = this.ju.getOwnProperty(item, "prop_hc_path");
		if(!path)
			return;
		var icon = this.ju.getOwnProperty(item, "prop_hc_icon");
		delete item.prop_hc_icon;
		var img = this.ju.getOwnProperty(item, "prop_hc_image");
		delete item.prop_hc_image;

		const ttBase = "attr_" + this.ui.tooltipAttrBase;
		var n = -1;

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
		item[ttBase + ++n] = path;
		item.prop_hc_path = path;

		var args = this.ju.getOwnProperty(item, "prop_hc_args");
		if(this.ju.isArray(args))
			for(var j = 0, len = args.length; j < len; ++j)
				item[ttBase + ++n] = args[j];
		var addNums = uris.length > 1;
		uris.forEach(function(uri, indx) {
			item[ttBase + ++n] = (addNums ? (indx + 1) + ". " : "") + uri;
		});
	},

	addEditItem: function(items) {
		const cmd = "handyClicksFuncs.openEditorForLastEvent();";
		const label = this.getLocalized("edit");
		const accesskey = this.getLocalized("editAccesskey");
		const sepClass = "handyClicks-editItem-separator";
		const miClass = "menuitem-iconic handyClicks-iconic handyClicks-editItem";
		if(this.ju.isArray(items)) {
			items.push(
				{
					tagName: "menuseparator",
					attr_class: sepClass
				},
				{
					tagName: "menuitem",
					attr_oncommand: cmd,
					attr_class: miClass,
					attr_label: label,
					attr_accesskey: accesskey
				}
			);
			return;
		}
		if(this.ju.isObject(items) && "nodeName" in items) {
			var df = document.createDocumentFragment();
			df.appendChild(this.ut.createElement("menuseparator", {
				class: sepClass
			}));
			df.appendChild(this.ut.createElement("menuitem", {
				oncommand: cmd,
				class: miClass,
				label: label,
				accesskey: accesskey
			}));
			items.appendChild(df);
			return;
		}
		if(typeof items == "xml") {
			this.ut._warn("addEditItem() with E4X is deprecated");
			eval('\
				var sep = <menuseparator xmlns={this.XULNS} />;\
				var mi = <menuitem xmlns={this.XULNS}\
					oncommand={cmd}\
					class={miClass}\
					label={label}\
					accesskey={accesskey}\
				/>;\
				items.lastChild += sep + mi;'
			);
			return;
		}
		this.ut._warn("addEditItem: unsupported items: (" + typeof items + ") " + items);
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
		return this.defaultCharset = this.getStr("chrome://global-platform/locale/intl.properties", "intl.charset.default");
	},
	get charset() {
		var charset = "";
		if(this.pu.get("funcs.convertURIs")) {
			charset = this.pu.get("funcs.convertURIsCharset");
			if(!charset) {
				charset = this.pu.getPref("intl.charset.default");
				if(!charset || this.ju.startsWith(charset, "chrome://"))
					charset = this.defaultCharset;
			}
		}
		return charset;
	},
	convertStrFromUnicode: function(str) {
		var charset = this.charset;
		if(!charset)
			return str;
		this._log("convertStrFromUnicode -> charset -> " + charset);
		var uc = charset == "UTF-8"
			? this.io.utf8Converter
			: this.io.unicodeConverter(charset);
		try {
			str = decodeURIComponent(str); // to UTF-8
		}
		catch(e) { // does not work in fx 1.5
			str = uc.ConvertToUnicode(unescape(str)); // Thanks to IE Tab!
			str = decodeURI(str);
		}
		return uc.ConvertFromUnicode(str) + uc.Finish();
	},
	openUriWithApp: function(e, popup) {
		var tar = e.target;
		if(!tar.hasOwnProperty("hc_path"))
			return;
		var args = tar.hc_args || [];
		//args.push(popup.hc_uri);
		var uris = Array.prototype.concat.call(popup.hc_uri).map(this.convertStrFromUnicode, this);
		this.ut.startProcess(tar.hc_path, Array.prototype.concat.call(args, uris), this.pu.get("funcs.preferRunw"));
	},
	decodeURI: function(uri) {
		if(!uri)
			return "";
		if(!/^(?:http|ftp)s?:/i.test(uri) && !this.pu.get("funcs.decodeURIs.unknownProtocols"))
			return uri;
		var decoded = this.losslessDecodeURI(uri);
		if(!this.pu.get("funcs.decodeURIs.spaces"))
			decoded = decoded.replace(/\s/g, encodeURIComponent);
		return decoded;
	},
	losslessDecodeURI: function(uri) {
		if(uri == "")
			return "";

		var win = window;
		if(!("losslessDecodeURI" in win))
			win = this.wu.browserWindow;
		if(win && "losslessDecodeURI" in win) try {
			return win.losslessDecodeURI(win.makeURI(uri));
		}
		catch(e) {
			Components.utils.reportError(e);
		}

		// Based on losslessDecodeURI() function from
		// chrome://browser/content/browser.js in Firefox 48.0a2 (2016-05-08)

		var decodeASCIIOnly = !/^(?:https?|file|ftp):/i.test(uri);
		// Try to decode as UTF-8 if there's no encoding sequence that we would break.
		if(!/%25(?:3B|2F|3F|3A|40|26|3D|2B|24|2C|23)/i.test(uri)) {
			if(decodeASCIIOnly) {
				// This only decodes ascii characters (hex) 20-7e, except 25 (%).
				// This avoids both cases stipulated below (%-related issues, and \r, \n
				// and \t, which would be %0d, %0a and %09, respectively) as well as any
				// non-US-ascii characters.
				uri = uri.replace(/%(2[0-4]|2[6-9a-f]|[3-6][0-9a-f]|7[0-9a-e])/g, decodeURI);
			}
			else {
				try {
					uri = decodeURI(uri)
						// 1. decodeURI decodes %25 to %, which creates unintended
						//    encoding sequences. Re-encode it, unless it's part of
						//    a sequence that survived decodeURI, i.e. one for:
						//    ';', '/', '?', ':', '@', '&', '=', '+', '$', ',', '#'
						//    (RFC 3987 section 3.2)
						// 2. Re-encode whitespace so that it doesn't get eaten away
						//    by the location bar (bug 410726).
						.replace(/%(?!3B|2F|3F|3A|40|26|3D|2B|24|2C|23)|[\r\n\t]/ig, encodeURIComponent);
				}
				catch(e) {
					Components.utils.reportError(e);
				}
			}
		}

		// Encode invisible characters (C0/C1 control characters, U+007F [DEL],
		// U+00A0 [no-break space], line and paragraph separator,
		// object replacement character) (bug 452979, bug 909264)
		uri = uri.replace(/[\u0000-\u001f\u007f-\u00a0\u2028\u2029\ufffc]/g, encodeURIComponent);

		// Encode default ignorable characters (bug 546013)
		// except ZWNJ (U+200C) and ZWJ (U+200D) (bug 582186).
		// This includes all bidirectional formatting characters.
		// (RFC 3987 sections 3.2 and 4.1 paragraph 6)
		uri = uri.replace(
			/[\u00ad\u034f\u061c\u115f-\u1160\u17b4-\u17b5\u180b-\u180d\u200b\u200e-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufff8]|\ud834[\udd73-\udd7a]|[\udb40-\udb43][\udc00-\udfff]/g,
			encodeURIComponent
		);
		return uri;
	},
	getWinRestriction: function(inWin) {
		return inWin === true
			? 1 // Open in new window
			: inWin === -1 // -1 - global value, other - override
				? this.pu.getPref("browser.link.open_newwindow.restriction")
				: inWin;
	},
	setPrefs: function(target /* "cur", "win" or "tab" */, bg, refererPolicy, winRestriction, winOpenFix) {
		if(arguments.length == 2) { // API usage: function(prefs, key)
			var apiPrefs = arguments[0];
			var apiKey   = arguments[1];
		}
		var key = "_origPrefs" + (apiKey || "");
		if(key in this)
			return;
		var origs = this[key] = { __proto__: null };
		var prefs = apiPrefs || {
			"browser.tabs.loadDivertedInBackground": target == "tab" && bg || null,
			"browser.link.open_newwindow.restriction": winRestriction === undefined
				? 0
				: this.getWinRestriction(winRestriction),
			"browser.link.open_newwindow": target == "cur" && 1 || target == "win" && 2 || target == "tab" && 3,
			"network.http.sendRefererHeader": this.getRefererPolicy(refererPolicy),
			"dom.disable_open_during_load": winOpenFix ? false : null
		};
		for(var p in prefs) if(prefs.hasOwnProperty(p)) {
			var val = prefs[p];
			if(val === null)
				continue;
			var orig = this.pu.getPref(p);
			if(orig != undefined && val != orig) {
				origs[p] = orig;
				this.pu.setPref(p, val);
			}
		}
	},
	restorePrefs: function(key) {
		key = "_origPrefs" + (key || "");
		if(!(key in this))
			return;
		var prefs = this[key];
		setTimeout(function(_this) { // For Firefox 3.0+, timeout should be > 0 for Firefox 11.0+
			for(var p in prefs)
				_this.pu.setPref(p, prefs[p]);
			delete _this[key];
		}, 5, this);
	},
	submitForm: function(e, target, loadInBackground, refererPolicy, node) {
		// Thanks to SubmitToTab! ( https://addons.mozilla.org/firefox/addon/483 )
		node = node || this.hc.item;
		node = new XPCNativeWrapper(node, "form", "click()"); // ?
		var form = node.form;
		var origTarget = form.hasAttribute("target") && form.getAttribute("target");
		form.target = target == "cur" ? "" : "_blank";

		this.setPrefs(target, loadInBackground, refererPolicy, undefined /* winRestriction */, true /* winOpenFix */);

		this.hc._enabled = false; // Don't stop this "click"
		node.click();
		this.hc._enabled = true;

		this.attribute(form, "target", origTarget, true);
		this.restorePrefs();
	},

	get tabs() {
		var tbr = this.hc.getTabBrowser(true);
		return tbr.tabs || tbr.tabContainer.childNodes;
	},
	get visibleTabs() {
		var tbr = this.hc.getTabBrowser(true);
		return tbr.visibleTabs || tbr.tabs || tbr.tabContainer.childNodes;
	},
	getSimilarTabs: function(tab) {
		if(!tab) {
			if(this.hc.itemType == "tab")
				tab = this.hc.item;
			else {
				var tbr = this.hc.getTabBrowser();
				tab = tbr.selectedTab;
			}
			if(!tab)
				return Array.prototype.slice.call(this.visibleTabs);
		}
		var pinned = tab.pinned;
		return Array.prototype.slice.call(this.visibleTabs).filter(function(tab) {
			return tab.pinned == pinned;
		});
	},
	getTabPos: function(tab) {
		if("_tPos" in tab) // Firefox
			return tab._tPos;
		return Array.prototype.indexOf.call(this.tabs, tab); // SeaMonkey
	},
	forEachTab: function(func, context) {
		return Array.prototype.forEach.call(this.visibleTabs, func, context || this);
	},
	mapTabs: function(func, context) {
		return Array.prototype.map.call(this.visibleTabs, func, context || this);
	},
	fixTab: function(tab) {
		tab = tab || this.hc.item;
		if(!tab || tab.localName != "tab")
			tab = this.hc.getTabBrowser().selectedTab;
		return tab;
	},
	removeOtherTabs: function(e, tab) {
		tab = this.fixTab(tab);
		var tbr = this.hc.getTabBrowser();
		//tbr.removeAllTabsBut(tab);
		var tabs = this.getSimilarTabs(tab).filter(function(t) {
			return t != tab;
		});
		if(this.warnAboutClosingTabs(tabs.length, tbr)) {
			if(tabs.indexOf(tbr.selectedTab) != -1)
				tbr.selectedTab = tab;
			tabs.forEach(tbr.removeTab, tbr);
		}
	},
	removeAllTabs: function(e) { //~ todo: allGroups argument?
		var tbr = this.hc.getTabBrowser();
		var tabs = this.getSimilarTabs();
		var _tabs = [];
		var curTab = tbr.selectedTab;
		var removeCurTab = false;
		for(var i = 0, len = tabs.length; i < len; ++i) {
			if(tabs[i] == curTab) // Avoid reflows after tab reselection
				removeCurTab = true;
			else
				_tabs.push(tabs[i]);
		}
		if(removeCurTab)
			_tabs.push(curTab);
		if(this.warnAboutClosingTabs(_tabs.length, tbr))
			_tabs.forEach(tbr.removeTab, tbr);
	},
	removeRightTabs: function(e, tab) {
		tab = this.fixTab(tab);
		var tbr = this.hc.getTabBrowser();
		var tabs = this.getSimilarTabs(tab);
		var _tabs = [];
		var curTab = tbr.selectedTab;
		var removeCurTab = false;
		for(var i = tabs.length - 1; i >= 0; --i) {
			if(tabs[i] == tab)
				break;
			if(tabs[i] == curTab) // Avoid reflows after tab reselection
				removeCurTab = true;
			else
				_tabs.push(tabs[i]);
		}
		if(removeCurTab)
			_tabs.push(curTab);
		if(this.warnAboutClosingTabs(_tabs.length, tbr))
			_tabs.forEach(tbr.removeTab, tbr);
	},
	removeLeftTabs: function(e, tab) {
		tab = this.fixTab(tab);
		var tbr = this.hc.getTabBrowser();
		var tabs = this.getSimilarTabs(tab);
		var _tabs = [];
		var curTab = tbr.selectedTab;
		var removeCurTab = false;
		for(var i = 0, len = tabs.length; i < len; ++i) {
			if(tabs[i] == tab)
				break;
			if(tabs[i] == curTab) // Avoid reflows after tab reselection
				removeCurTab = true;
			else
				_tabs.push(tabs[i]);
		}
		if(removeCurTab)
			_tabs.push(curTab);
		if(this.warnAboutClosingTabs(_tabs.length, tbr))
			_tabs.forEach(tbr.removeTab, tbr);
	},
	warnAboutClosingTabs: function(tabsToClose, tbr) {
		// Based on code from Firefox 1.5 - 3.0 + changes from newer versions
		// chrome://browser/content/tabbrowser.xml -> warnAboutClosingTabs()
		tbr = tbr || this.hc.getTabBrowser();
		tabsToClose = typeof tabsToClose == "number"
			? tabsToClose
			: tbr.tabContainer.childNodes.length;
		var reallyClose = true;
		if(tabsToClose <= 1)
			return reallyClose;
		const pref = "browser.tabs.warnOnClose";
		var shouldPrompt = this.pu.getPref(pref);
		if(shouldPrompt) {
			var pSvc = this.ut.promptsSvc;
			// default to true: if it were false, we wouldn't get this far
			var warnOnClose = { value: true };
			var bundle = tbr.mStringBundle || {
				getString: function(name) { // Firefox 58+
					return gTabBrowserBundle.GetStringFromName(name);
				}
			};
			var messageKey = this.isSeaMonkey
				? "tabs.closeWarning"
				: this.fxVersion == 1.5
					? tabsToClose == 1 ? "tabs.closeWarningOne"    : "tabs.closeWarningMultiple"
					: tabsToClose == 1 ? "tabs.closeWarningOneTab" : "tabs.closeWarningMultipleTabs";
			try {
				var warningMessage = bundle.getFormattedString(messageKey, [tabsToClose]);
			}
			catch(e) { // Firefox 29+ (but not Pale Moon 28 and older)
				warningMessage = PluralForm.get(tabsToClose, bundle.getString("tabs.closeWarningMultiple"))
					.replace("#1", tabsToClose);
			}
			var closeKey = this.isSeaMonkey
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
				warningMessage,
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
				this.pu.setPref(pref, false);
		}
		return reallyClose;
	},
	removeTab: function(e, tab) {
		tab = this.fixTab(tab);
		this.hc.getTabBrowser().removeTab(tab, { animate: true });
	},
	renameTab: function(e, tab) {
		tab = this.fixTab(tab);
		var doc = tab.linkedBrowser.contentDocument;
		var curTitle = doc && doc.title || tab.label;
		var newTitle = this.ut.prompt(
			this.getLocalized("renameTabTitle"),
			this.getLocalized("tabNewName"),
			curTitle
		);
		const p = "__handyClicks__title";
		if(newTitle != null) {
			tab[p] = curTitle;
		}
		else if(p in tab) {
			newTitle = tab[p];
			delete tab[p];
		}
		else {
			return;
		}
		if(doc)
			doc.title = newTitle;
		if(!doc || tab.getAttribute("pending") == "true")
			tab.label = newTitle;
	},
	toggleTabPinned: function(e, tab) {
		tab = this.fixTab(tab);
		var tbr = this.hc.getTabBrowser(true);
		tbr[tab.pinned ? "unpinTab" : "pinTab"](tab);
	},
	reloadAllTabs: function(e, skipCache) {
		this.forEachTab(function(tab) {
			this.reloadTab(e, skipCache, tab);
		});
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
		this.forEachTab(function(tab) {
			this.stopTabLoading(e, tab);
		});
	},
	stopTabLoading: function(e, tab) {
		tab = this.fixTab(tab);
		var br = tab.linkedBrowser;
		br.stop();
	},
	undoCloseTab: function(e) {
		if("undoCloseTab" in window) // Firefox 2.0+
			undoCloseTab(0);
		else if("gBrowser" in window && "undoCloseTab" in gBrowser) // SeaMonkey
			gBrowser.undoCloseTab(0);
		else if("TMP_ClosedTabs" in window) // Tab Mix Plus
			TMP_ClosedTabs.undoCloseTab();
		else if("gSessionManager" in window) // Old Session Manager
			gSessionManager.undoCloseTab();
	},
	get ss() {
		delete this.ss;
		return this.ss = (
			Components.classes["@mozilla.org/browser/sessionstore;1"]
			|| Components.classes["@mozilla.org/suite/sessionstore;1"]
		).getService(Components.interfaces.nsISessionStore);
	},
	cloneTab: function(e, tab) {
		tab = this.fixTab(tab);
		var tbr = this.hc.getTabBrowser();
		var ind = this.getTabPos(tab) + 1;
		if("duplicateTab" in tbr) // Firefox 3.0+
			var newTab = tbr.duplicateTab(tab);
		else if("duplicateTab" in this.ss) // SeaMonkey
			var newTab = this.ss.duplicateTab(window, tab);
		else // Not a real "clone"... Just URI's copy
			var newTab = tbr.addTab(this.getTabURI(tab));
		if("TreeStyleTabService" in window && ind == tbr.browsers.length - 1)
			tbr.moveTabTo(newTab, ind - 1); // Fix bug for last tab moving
		tbr.moveTabTo(newTab, ind);
		tbr.selectedTab = newTab;
	},
	newTab: function(e) {
		BrowserOpenTab();
	},

	// Multiple Tab Handler extension
	// http://piro.sakura.ne.jp/xul/_multipletab.html.en#api-multipletabs
	get hasMultipleTabHandler() {
		if("MultipleTabService" in window)
			return true;
		this.ut._warn(this.getMissingExtWarning("Multiple Tab Handler", 4838));
		return false;
	},
	mthCloseTabs: function(e, tabs) {
		this.hasMultipleTabHandler && MultipleTabService.closeTabs(tabs || this.hc.item);
	},
	mthCloseOtherTabs: function(e, tabs) {
		this.hasMultipleTabHandler && MultipleTabService.closeOtherTabs(tabs || this.hc.item);
	},
	mthReloadTabs: function(e, tabs) {
		this.hasMultipleTabHandler && MultipleTabService.reloadTabs(tabs || this.hc.item);
	},
	mthAddBookmarkFor: function(e, tabs) {
		this.hasMultipleTabHandler && MultipleTabService.addBookmarkFor(tabs || this.hc.item);
	},
	mthDuplicateTabs: function(e, tabs) {
		this.hasMultipleTabHandler && MultipleTabService.duplicateTabs(tabs || this.hc.item);
	},
	mthSplitWindowFromTabs: function(e, tabs) {
		this.hasMultipleTabHandler && MultipleTabService.splitWindowFromTabs(tabs || this.hc.item);
	},

	reloadImg: function(e, img) {
		img = img || this.hc.item;
		var src = img.src;
		if(!src || /^data:/i.test(src)) {
			this._log("reloadImg(): nothing to reload");
			return;
		}
		this.ui.blinkNode(undefined /*default duration*/, img);
		var origStyle = img.hasAttribute("style") && img.getAttribute("style");
		var cs = this.getStyle(img);
		var w = cs.width;
		var h = cs.height;
		var stl = img.style;
		stl.setProperty("width", w, "important");
		stl.setProperty("height", h, "important");
		if(parseInt(w) > 24 || parseInt(h) > 24)
			stl.setProperty("background", "url(\"" + this.dt.loading + "\") center no-repeat", "important");

		var _this = this;
		function resetSrc() {
			img.addEventListener("load", function onLoad() {
				img.removeEventListener("load", onLoad, false);
				function done(e) {
					img.removeEventListener("load", done, false);
					img.removeEventListener("error", done, false);
					_this.attribute(img, "style", origStyle, true);
				}
				img.addEventListener("load", done, false);
				img.addEventListener("error", done, false);
				_this._log("reloadImg(): restore original src");
				img.src = src;
			}, false);
			img.src = _this.dt.spacer; // transparent gif 1x1
		}

		// See https://github.com/Infocatcher/Custom_Buttons/tree/master/Reload_Broken_Images
		if(img instanceof Components.interfaces.nsIImageLoadingContent && img.currentURI) try {
			var uri = img.currentURI;
			var tools = "imgITools" in Components.interfaces
				&& Components.classes["@mozilla.org/image/tools;1"]
					.getService(Components.interfaces.imgITools);
			var cache = tools && "getImgCacheForDocument" in tools // Gecko 18+
				? tools.getImgCacheForDocument(img.ownerDocument)
				: Components.classes["@mozilla.org/image/cache;1"]
					.getService(Components.interfaces.imgICache);
			if(cache.findEntryProperties(uri))
				cache.removeEntry(uri);
			this._log("reloadImg() -> imgICache.removeEntry()");
			resetSrc();
		}
		catch(e) {
			// imgICache.removeEntry() removed in Firefox 44+:
			// https://bugzilla.mozilla.org/show_bug.cgi?id=1202085#c39
			if(("" + e).indexOf("removeEntry is not a function") == -1)
				Components.utils.reportError(e);
			this._log("reloadImg(): will use trick with XMLHttpRequest()");
			var req = new XMLHttpRequest();
			req.open("GET", src, true);
			req.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
			req.onload = req.onerror = resetSrc;
			req.send(null);
		}
	},
	copyImg: function(e, img) {
		img = img || this.hc.item;
		//~ todo: use popup.triggerNode ? (https://bugzilla.mozilla.org/show_bug.cgi?id=383930)
		document.popupNode = img;
		goDoCommand("cmd_copyImageContents");
		this.ui.blinkNode(undefined /*default duration*/, img);
	},
	getStyle: function(item, propName) {
		item = item || this.hc.item;
		var cs = item.ownerDocument.defaultView.getComputedStyle(item, null);
		if(propName)
			return cs && cs[propName];
		return cs;
	},
	openSimilarLinksInTabs: function(e, refererPolicy, a) {
		a = a || this.hc.item;
		var term = this.ut.innerXML(a);
		if(!term) {
			this.ut._err("openSimilarLinksInTabs() is not supported: can't serialize a.childNodes to string");
			return;
		}
		var ps = this.ut.promptsSvc;
		var onlyUnvisited = { value: false };
		// https://bugzilla.mozilla.org/show_bug.cgi?id=345067
		// confirmEx always returns 1 if the user closes the window using the close button in the titlebar
		this.ut.ensureNotMinimized();
		var button = ps.confirmEx(
			window, this.getLocalized("title"),
			this.getLocalized("openSimilarLinksConfirm"),
			  ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_0_DEFAULT,
			this.getLocalized("openButton"), "", this.getLocalized("openWithDelaysButton"),
			this.getLocalized("openOnlyVisited"), onlyUnvisited
		);
		if(button == 1)
			return;
		onlyUnvisited = onlyUnvisited.value;
		var useDelays = button == 2;

		// Based on code by Yan ( http://forum.mozilla-russia.org/viewtopic.php?pid=144109#p144109 )
		var hrefs = { __proto__: null };
		var onlyVisible = this.pu.get("funcs.openOnlyVisibleLinks");
		Array.prototype.forEach.call(
			a.ownerDocument.getElementsByTagName(a.localName),
			function(a) {
				var t = this.ut.innerXML(a);
				var h = this.getLinkURI(a);
				if(
					t == term && h && !this.isJSURI(h)
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

		if(!onlyUnvisited)
			this.openLinks(hrefs, refererPolicy, useDelays);
		else {
			this.filterVisited(hrefs, this.ju.bind(function() {
				this.openLinks(hrefs, refererPolicy, useDelays);
			}, this));
		}
	},
	get asyncHistory() {
		delete this.asyncHistory;
		return this.asyncHistory = "mozIAsyncHistory" in Components.interfaces
			&& Components.classes["@mozilla.org/browser/history;1"]
				.getService(Components.interfaces.mozIAsyncHistory);
	},
	filterVisited: function(hrefs, callback) {
		// Used makeURI() from chrome://global/content/contentAreaUtils.js
		var asyncHistory = this.asyncHistory;
		if(!asyncHistory || !("isURIVisited" in asyncHistory)) { // Gecko < 11.0
			var gh = Components.classes["@mozilla.org/browser/global-history;2"]
				.getService(Components.interfaces.nsIGlobalHistory2 || Components.interfaces.nsIGlobalHistory);
			for(var h in hrefs)
				if(gh.isVisited(makeURI(h)))
					delete hrefs[h];
			callback();
			return;
		}
		var count = 0;
		function isURIVisitedCallback(uri, isVisited) {
			if(isVisited)
				delete hrefs[uri.spec];
			if(!--count)
				callback();
		}
		for(var h in hrefs) {
			++count;
			asyncHistory.isURIVisited(makeURI(h), isURIVisitedCallback);
		}
	},
	openLinks: function(hrefs, refererPolicy, useDelays) {
		var tbr = this.hc.getTabBrowser(true);
		var ref = this.getRefererForItem(refererPolicy);

		var count = 0;
		for(var h in hrefs)
			++count;
		if("PlacesUIUtils" in window && "_confirmOpenInTabs" in PlacesUIUtils) {
			if(!PlacesUIUtils._confirmOpenInTabs(count))
				return;
		}
		if(!count)
			return;

		if("TreeStyleTabService" in window) { // Tree Style Tab
			var hasTreeStyleTab = true;
			var _tab = tbr.selectedTab;
		}
		var hasTabKit = "tabkit" in window; // Tab Kit

		if(!useDelays) {
			hasTreeStyleTab && TreeStyleTabService.readyToOpenChildTab(_tab, true);
			for(var h in hrefs) {
				hasTabKit && tabkit.addingTab("related");
				tbr.addTab(h, ref);
				hasTabKit && tabkit.addingTabOver();
			}
			hasTreeStyleTab && TreeStyleTabService.stopToOpenChildTab(_tab);
			return;
		}

		var showProgress = count >= 2;
		if(showProgress) {
			this.ui.showProgress = true;
			var i = this.ui.progressPart;
			this.ui.progressCount += count;
			this.ui.progressLabel = i + "/" + this.ui.progressCount;
			this.ui.progress.max = this.ui.progressCount*10;
			this.ui.progress.value = i*10;
			this.ui.setTaskbarProgressState(i, this.ui.progressCount);
		}

		var _this = this;
		var delay = this.pu.get("funcs.multipleTabsOpenDelay") || 0;
		(function delayedOpen() {
			if(_this.ui.userCancelled)
				return;
			for(var h in hrefs) {
				delete hrefs[h];
				break;
			}
			hasTreeStyleTab && TreeStyleTabService.readyToOpenChildTab(_tab);
			hasTabKit && tabkit.addingTab("related");
			tbr.addTab(h, ref);
			hasTabKit && tabkit.addingTabOver();
			if(showProgress) {
				_this.ui.progressLabel = ++_this.ui.progressPart + "/" + _this.ui.progressCount;
				var state = _this.ui.progressPart*10;
				_this.ui.progress.value = state;
				_this.ui.setTaskbarProgressState(_this.ui.progressPart, _this.ui.progressCount);
				var done = state >= _this.ui.progress.max;
			}
			if(_this.ju.isEmptyObj(hrefs)) {
				showProgress && done && _this.ui.progressDelayedHide();
				return;
			}
			setTimeout(delayedOpen, delay);
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
	}
};
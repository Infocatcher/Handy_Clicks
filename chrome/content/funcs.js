var handyClicksFuncs = {
	// Shortcuts:
	ut: handyClicksUtils,
	pu: handyClicksPrefUtils,
	ps: handyClicksPrefSvc,
	hc: handyClicks,

	relativeIndex: 0,

	voidURIMask: /^javascript: *(?:|\/\/|void *(?: +0|\( *0 *\))) *;? *$/i,
	isVoidURI: function(uri) {
		uri = (uri || "").replace(/(?:\s|%20)+/g, " ");
		return this.voidURIMask.test(uri);
	},

	copyItemText: function(e, hidePopup) { // for all
		var text = this.hc.itemType == "tabbar"
			? this.forEachTab(function(tab) { return tab.label; }).join("\n")
			: this.getTextOfItem();
		if(text) {
			this.copyStr(text);
			this.hc.blinkNode();
		}
		if(hidePopup)
			this.hideItemPopup();
	},
	copyItemLink: function(e, hidePopup) {
		var link = this.hc.itemType == "tabbar"
			? this.forEachTab(this.getTabUri).join("\n")
			: this.getUriOfItem() || "";
		if(link) {
			this.copyStr(link);
			this.hc.blinkNode();
		}
		if(hidePopup)
			this.hideItemPopup();
	},
	getTextOfItem: function(it) {
		it = it || this.hc.item;
		return it.textContent || it.label || it.alt || it.value || "";
	},
	getUriOfItem: function(it, itemType) {
		it = it || this.hc.item;
		var uri = null;
		switch(itemType || this.hc.itemType) {
			case "link":
				uri = this.getLinkUri(it);
			break;
			case "img":
				uri = it.src;
			break;
			case "bookmark":
			case "historyItem":
				uri = this.getBookmarkUri(it);
			break;
			case "tab":
				uri = this.getTabUri(it);
			break;
			default: // Support for custom types
				uri = this.getLinkUri(it)
					|| it.src
					|| this.getBookmarkUri(it)
					|| this.getTabUri(it);
		}
		return uri;
	},
	getLinkUri: function(it) {
		var xLink = it.getAttributeNS("http://www.w3.org/1999/xlink", "href");
		return xLink
			? makeURLAbsolute(it.baseURI, xLink) // See chrome://browser/content/utilityOverlay.js
			: it.href;
	},
	getBookmarkUri:	function(it, usePlacesURIs) {
		var uri = it.statusText || (it.node && it.node.uri) || it.getAttribute("siteURI") || "";
		return !usePlacesURIs && /^place:/.test(uri) ? "" : uri;
	},
	getTabUri: function(tab) {
		return "linkedBrowser" in tab
			? tab.linkedBrowser.contentDocument.location.href
			: "";
	},
	forEachTab: function(fnc, tbr) {
		tbr = tbr || this.getTabBrowser(true);
		var res = [];
		var tabs = tbr.mTabContainer.childNodes;
		for(var i = 0, len = tabs.length; i < len; i++)
			res.push(fnc(tabs[i]));
		return res;
	},
	copyStr: function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str);
	},
	openUriInCurrentTab: function(e, refererPolicy, hidePopup, uri) {
		uri = uri || this.getUriOfItem(this.hc.item);
		if(this.testForHighlander(uri))
			return;
		this.getTabBrowser().loadURI(uri, this.getRefererForItem(refererPolicy));
		if(hidePopup)
			this.hideItemPopup();
	},
	testForHighlander: function(uri) {
		// Highlander ( https://addons.mozilla.org/firefox/addon/4086 )
		if("Highlander" in window) {
			var tab = Highlander.findTabForURI(makeURI(uri));
			if(tab) {
				Highlander.selectTab(tab);
				return true;
			}
		}
		return false;
	},
	openUriInTab: function(e, loadInBackground, loadJSInBackground, refererPolicy, moveTo, hidePopup, inWin) {
		var tbr = this.getTabBrowser(true);
		if(moveTo == "relative") {
			var tabCont = tbr.mTabContainer;
			tabCont.__handyClicks__resetRelativeIndex = false;
		}
		var tab = this._openUriInTab(e, null, null, loadInBackground, loadJSInBackground, refererPolicy, moveTo, inWin);
		if(hidePopup)
			this.hideItemPopup();
		if(!tab || !moveTo)
			return;
		var curTab = tbr.mCurrentTab;
		var curInd = curTab._tPos, ind = 0;
		switch(moveTo) {
			case "first":    ind = 0;                             break;
			case "before":   ind = curInd;                        break;
			case "after":    ind = curInd + 1;                    break;
			case "last":     ind = tbr.browsers.length;           break;
			case "relative": ind = curInd + ++this.relativeIndex; break;
			default:
				this.ut._err("[Right Links]: openUriInTab -> invalid moveTo argument: " + moveTo);
				return;
		}
		this.ut._log(this.relativeIndex);
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
			tabCont.__handyClicks__resetRelativeIndex = false;
			_this.relativeIndex = 0;
		};
		tabCont.addEventListener("TabClose", _resetRelativeIndex, true);
		tabCont.addEventListener("TabSelect", _resetRelativeIndex, true);
		// tabCont.addEventListener("select", _resetRelativeIndex, true);
		window.addEventListener(
			"unload",
			function(e) {
				tabCont.__handyClicks__listeners = false;
				tabCont.removeEventListener(e.type, arguments.callee, false);
				tabCont.removeEventListener("TabClose", _resetRelativeIndex, true);
				tabCont.removeEventListener("TabSelect", _resetRelativeIndex, true);
				// tabCont.removeEventListener("select", _resetRelativeIndex, true);
			},
			false
		);
	},
	_openUriInTab: function(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy, moveTo, inWin) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getUriOfItem(item);
		if(this.testForLinkFeatures(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy, inWin))
			return null;
		var tbr = this.getTabBrowser(true);

		// Open a new tab as a child of the current tab (Tree Style Tab)
		// http://piro.sakura.ne.jp/xul/_treestyletab.html.en#api
		if(!moveTo && this.ut.isNoChromeDoc(item.ownerDocument) && "TreeStyleTabService" in window)
			TreeStyleTabService.readyToOpenChildTab(tbr.selectedTab);
		return tbr.loadOneTab(
			uri,
			this.getRefererForItem(refererPolicy, false, item),
			null, null,
			loadInBackground,
			false
		);
	},
	testForLinkFeatures: function(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy, inWin) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getUriOfItem(item);
		if(/^javascript:/i.test(uri)) {
			this.loadJavaScriptLink(e, item, uri, loadJSInBackground, refererPolicy, inWin);
			return true;
		}
		if(this.testForFileLink(uri, refererPolicy) || this.testForHighlander(uri))
			return true;
		return false;
	},
	loadJavaScriptLink: function(e, item, uri, loadJSInBackground, refererPolicy, inWin) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getUriOfItem(item);
		if( // void links with handlers
			this.hc.itemType == "link"
			&& (!uri || this.isVoidURI(uri))
			&& (
				item.hasAttribute("onclick")
				|| item.hasAttribute("onmousedown")
				|| item.hasAttribute("onmouseup")
			)
		)
			this.loadVoidLinkWithHandler(e, item, loadJSInBackground, refererPolicy, inWin);
		else
			this.loadNotVoidJavaScriptLink(e, item, uri, loadJSInBackground, refererPolicy, inWin);
	},
	loadVoidLinkWithHandler: function(e, item, loadJSInBackground, refererPolicy, inWin) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		var evt = document.createEvent("MouseEvents"); // thanks to Tab Scope!
		evt.initMouseEvent(
			"click", false, false, item.ownerDocument.defaultView, 1,
			e.screenX, e.screenY, e.clientX, e.clientY,
			false, false, false, false,
			0, null
		);
		var _this = this;
		function _f() {
			var origPrefs = _this.setPrefs({
				"browser.link.open_newwindow.restriction": _this.getWinRestriction(inWin),
				"browser.tabs.loadDivertedInBackground": loadJSInBackground,
				"network.http.sendRefererHeader": _this.getRefererPolicy(refererPolicy)
			});
			var sc = _this.hc.flags.stopClick;
			_this.hc.flags.stopClick = false; // allow clicks
			item.dispatchEvent(evt);
			_this.hc.flags.stopClick = sc;
			_this.restorePrefs(origPrefs);
		}
		var load = this.pu.pref("loadVoidLinksWithHandlers");
		if(this.pu.pref("notifyVoidLinksWithHandlers"))
			this.ut.notify(
				this.ut.getLocalised("title"),
				this.ut.getLocalised("voidLinkWithHandler")
					+ (load ? "" : this.ut.getLocalised("clickForOpen")),
				(load ? null : _f)
			);
		if(load)
			_f();
	},
	getWinRestriction: function(inWin) {
		return inWin == true
			? 1 // Open in new window
			: inWin == -1 // -1 - global value, other - override
				? this.pu.getPref("browser.link.open_newwindow.restriction")
				: inWin;
	},
	loadNotVoidJavaScriptLink: function(e, item, uri, loadJSInBackground, refererPolicy, inWin) {
		item = item || this.hc.item;
		uri = uri || this.getUriOfItem(item);
		var _this = this;
		function _f() {
			var origPrefs = _this.setPrefs({
				"browser.link.open_newwindow.restriction": _this.getWinRestriction(inWin),
				"dom.disable_open_during_load": false, // allow window.open( ... )
				"browser.tabs.loadDivertedInBackground": loadJSInBackground,
				"network.http.sendRefererHeader": _this.getRefererPolicy(refererPolicy)
			});

			var oDoc = item.ownerDocument;
			if(_this.ut.isNoChromeDoc(oDoc))
				oDoc.location.href = uri;
			else
				_this.getTabBrowser().loadURI(uri); // bookmarklets

			setTimeout(function(_this) { _this.restorePrefs(origPrefs); }, 0, _this);
			// _this.restorePrefs(origPrefs);
		}
		var load = this.pu.pref("loadJavaScriptLinks");
		if(this.pu.pref("notifyJavaScriptLinks"))
			this.ut.notify(
				this.ut.getLocalised("title"),
				this.ut.getLocalised("javaScriptLink")
					+ (load ? "" : this.ut.getLocalised("clickForOpen")),
				(load ? null : _f)
			);
		if(load)
			_f();
	},
	testForFileLink: function(uri, refererPolicy) {
		uri = uri || this.getUriOfItem(this.hc.item);
		var filesPolicy = this.pu.pref("filesLinksPolicy");
		if(filesPolicy < 1)
			return false;
		var regexp = this.pu.pref("filesLinksMask");
		if(!regexp)
			return false;
		try {
			var _regexp = new RegExp(regexp, "i");
			if(!_regexp.test(uri))
				return false;
			if(filesPolicy == 1) {
				this.getTabBrowser().loadURI(uri, this.getRefererForItem(refererPolicy));
				return true;
			}
			this.hc.showPopupOnItem();
			return true;
		}
		catch(e) {
			this.ut.alertEx(
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("RegExpError").replace("%r", regexp).replace("%e", e)
			);
		}
		return false;
	},
	openUriInWindow: function(e, loadInBackground, loadJSInBackground, refererPolicy, moveTo, hidePopup) {
		var win = this._openUriInWindow(e, null, null, loadInBackground, loadJSInBackground, refererPolicy);
		if(hidePopup)
			this.hideItemPopup();
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
				this.ut._err("[Right Links]: openUriInWindow -> invalid moveTo argument: " + moveTo);
				return;
		}
		if(xCur !== undefined && yCur !== undefined)
			window.moveTo(xCur, yCur);
		if(wCur !== undefined && hCur !== undefined)
			window.resizeTo(wCur, hCur);
		this.initWindowMoving(win, xNew, yNew, wNew, hNew);
	},
	_openUriInWindow: function(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getUriOfItem(item);
		if(this.testForLinkFeatures(e, item, uri, loadInBackground, loadJSInBackground, refererPolicy, true))
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
	initZLevelRestoring: function(win) {
		var pw = window;
		var _this = this;
		win.addEventListener(
			"load",
			function() {
				win.removeEventListener("load", arguments.callee, false);
				setTimeout(
					function() {
						var fe = pw.document.commandDispatcher.focusedElement;
						pw.focus();
						if(fe)
							fe.focus();
						_this.restoreZLevel(win);
					},
					0
				);
			},
			false
		);
	},
	initWindowMoving: function(win, x, y, w, h) {
		win.addEventListener(
			"resize",
			function(e) {
				win.removeEventListener(e.type, arguments.callee, false);
				win.moveTo(x, y);
				win.resizeTo(w, h);
			},
			false
		);
	},
	restoreZLevel: function(win) {
		var treeowner = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIWebNavigation)
			.QueryInterface(Components.interfaces.nsIDocShellTreeItem)
			.treeOwner;
		var xulwin = treeowner.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIXULWindow);
		xulwin.zLevel = xulwin.normalZ;
	},
	openInSidebar: function(e, hidePopup, ttl, uri) {
		ttl = ttl || "";
		uri = uri || this.getUriOfItem(this.hc.item);
		openWebPanel(ttl, uri);
		if(hidePopup)
			this.hideItemPopup();
	},
	getTabBrowser: function(tabsRequired) {
		return "SplitBrowser" in window && !(tabsRequired && "TM_init" in window) // Tab Mix Plus
			? SplitBrowser.activeBrowser
			: gBrowser || getBrowser();
	},
	hideItemPopup: function(it) {
		it = it || this.hc.item;
		var mp = this.getMenupopup(it);
		if(mp && mp.hidePopup) {
			mp.hidePopup();
			var mn = mp.parentNode;
			if(mn && mn.nodeName == "menu")
				mn.removeAttribute("_moz-menuactive");
		}
	},
	getMenupopup: function(it) {
		it = it || this.hc.item;
		if(it.nodeName == "toolbarbutton")
			return false;
		var mp, ci = it, nn;
		do {
			ci = ci.parentNode;
			nn = ci.nodeName;
			if(nn == "menupopup")
				mp = ci;
		}
		while(ci && nn != "toolbar" && nn != "#document")
		return mp;
	},
	downloadWithFlashGot: function(e, item) {
		item = item || this.hc.item;
		if(typeof gFlashGot == "undefined") {
			this.ut._err("[Handy Clicks]: missing FlashGot extension ( https://addons.mozilla.org/firefox/addon/220 )");
			return;
		}
		document.popupNode = item;
		gFlashGot.downloadPopupLink();
	},
	openInSplitBrowser: function(e, position, hidePopup, uri, win) {
		position = (position || "bottom").toUpperCase();
		uri = uri || this.getUriOfItem(this.hc.item);
		win = win || this.hc.item.ownerDocument.defaultView;
		if(typeof SplitBrowser == "undefined") {
			this.ut._err("[Handy Clicks]: missing Split Browser extension ( https://addons.mozilla.org/firefox/addon/4287 )");
			return;
		}
		SplitBrowser.addSubBrowser(uri, null, SplitBrowser["POSITION_" + position]);
		if(hidePopup)
			this.hideItemPopup();
	},
	showGeneratedPopup: function(items) {
		var popup = this.createPopup(items);
		this.hc.showPopupOnItem(popup);
		return popup;
	},
	createPopup: function(items) {
		var popup = this.popup;
		this.appendChilds(popup, items);
		return popup;
	},
	get popup() {
		var pSet = document.getElementById("mainPopupSet");
		var id = "handyClicks-generatedPopup";
		var popup = document.getElementById(id);
		if(popup)
			pSet.removeChild(popup);
		popup = document.createElement("popup");
		popup.id = id;
		popup.tooltip = "handyClicks-tooltip";
		pSet.appendChild(popup);
		return popup;
	},
	appendChilds: function(parent, childs) {
		for(var i = 0; i < childs.length; i++)
			this["appendMenu" + (childs[i] instanceof Array ? "" : "item")](parent, childs[i]);
	},
	appendMenu: function(parent, itemsArr) {
		var menu = document.createElement("menu");
		this.setAttributes(menu, itemsArr[0]);
		var mPopup = document.createElement("menupopup");
		this.appendChilds(mPopup, itemsArr[1]);
		menu.appendChild(mPopup);
		parent.appendChild(menu);
	},
	appendMenuitem: function(parent, attrs) {
		var mi = document.createElement(attrs.label ? "menuitem" : "menuseparator");
		this.setAttributes(mi, attrs);
		parent.appendChild(mi);
	},
	setAttributes: function(item, attrs) {
		for(var p in attrs) {
			if(!attrs.hasOwnProperty(p))
				continue;
			if(typeof attrs[p] != "string" || p.indexOf("__") == 0)
				item[p] = attrs[p]; // not works for "oncommand"
			else
				item.setAttribute(p, attrs[p]);
		}
	},
	get profileDir() {
		delete this.profileDir;
		return this.profileDir = this.ps.profileDir.path.replace(/[\\\/]$/, "");
	},
	getRelativePath: function(path) {
		// Example:
		//   %profile%\..\..\..\OperaUSB\op.com
		// for
		//   x:\FirefoxPortable\Data\profile\
		//   x:\OperaUSB\op.com
		if(!/^%profile%([\/\\])((?:\.\.[\/\\])*)(.*)$/.test(path))
			return path;
		var pathStart = this.profileDir + RegExp.$1;
		var dirUp = RegExp.$2;
		var pathEnd = RegExp.$3;
		var _path = pathStart;
		var upCount = dirUp && dirUp.match(/\.\.[\/\\]/g).length;
		if(upCount) {
			_path = pathStart.replace(new RegExp("(?:[^\\/\\\\]+[\\/\\\\]){" + upCount + "}$"), "");
			if(!_path || _path == pathStart) {
				this.ut._err("[Handy Clicks]: Invalid relative path:\n" + path);
				return null;
			}
		}
		return _path + pathEnd;
	},
	startProcess: function(path, args) {
		args = args || [];
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try { file.initWithPath(path); }
		catch(e) { // E.g. this can be invalid relative path
			this.ut.notify(
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("invalidFilePath").replace("%p", path)
				+ this.ut.getLocalised("openConsole"),
				toErrorConsole
			);
			throw e;
		}
		if(!file.exists()) {
			this.ut.alertEx(
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("fileNotFound").replace("%p", path)
			);
			return;
		}
		var process = Components.classes["@mozilla.org/process/util;1"]
			.getService(Components.interfaces.nsIProcess);
		process.init(file);
		try { process.run(false, args, args.length); }
		catch(e) {
			this.ut.alertEx(
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("fileCantRun").replace("%p", path).replace("%e", e)
			);
		}
	},
	get defaultCharset() { // thanks to IE Tab!
		delete this.defaultCharset;
		var strBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
			.getService(Components.interfaces.nsIStringBundleService);
		var dch = "";
		try {
			dch = strBundle.createBundle("chrome://global-platform/locale/intl.properties")
				.GetStringFromName("intl.charset.default");
		}
		catch(e) {
		}
		return this.defaultCharset = dch || "";
	},
	get charset() {
		var charset = "";
		if(this.pu.pref("convertURIs")) {
			charset = this.pu.pref("convertURIsTo");
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
		var mi = e.target;
		if(mi.nodeName != "menuitem")
			return;
		var args = mi.__args || [];
		args.push(popup.__uri);
		this.startProcess(mi.__path, args);
	},
	decodeUri: function(value) { // code by Ex Bookmark Properties ( https://addons.mozilla.org/firefox/addon/7396 )
		// return decodeURIComponent(value);
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
			}
			catch (e) {
			}
		// Encode bidirectional formatting characters.
		// (RFC 3987 sections 3.2 and 4.1 paragraph 6)
		value = value.replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e]/g, encodeURIComponent);
		return value;
	},
	showOpenUriWithAppsPopup: function(items) {
		var uri = this.getUriOfItem();
		if(!uri) {
			this.ut._err("[Handy Clicks]: can't get URI of item (" + this.hc.itemType + ")");
			return;
		}
		var path, it, n, args, img;
		var attrBase = this.tooltipAttrBase;
		for(var i = 0; i < items.length; i++) {
			it = items[i], n = 0;
			path = it.__path;
			img = it.__image;
			if(path) {
				path = this.getRelativePath(path);
				it.class = "menuitem-iconic";
				img = (img && this.getRelativePath(img) || path);
				it.image = "moz-icon:file://" + img;
				it[attrBase + n++] = path;
				it.__path = path;
			}
			if(it.__args instanceof Array) {
				args = it.__args;
				for(var j = 0; j < args.length; j++)
					it[attrBase + n++] = args[j];
			}
			it[attrBase + n++] = this.decodeUri(uri);
		}
		var popup = this.showGeneratedPopup(items);
		popup.setAttribute("oncommand", "handyClicksFuncs.openUriWithApp(event, this);");
		popup.__uri = this.convertStrFromUnicode(uri);
	},
	setPrefs: function(prefsObj) {
		var origs = { __proto__: null };
		for(var p in prefsObj) {
			if(!prefsObj.hasOwnProperty(p) || prefsObj[p] == null)
				continue;
			origs[p] = this.pu.getPref(p);
			this.pu.setPref(p, prefsObj[p]);
		}
		return origs;
	},
	restorePrefs: function(prefsObj) {
		for(var p in prefsObj)
			this.pu.setPref(p, prefsObj[p]);
	},
	submitFormToNewDoc: function(e, toNewWin, loadInBackground, refererPolicy, node) {
		// Thanks to SubmitToTab! ( https://addons.mozilla.org/firefox/addon/483 )
		node = node || this.hc.item;
		node = new XPCNativeWrapper(node, "form", "click()");
		var origTarget = node.form.getAttribute("target");
		node.form.target = "_blank";

		var origPrefs = this.setPrefs({
			"browser.link.open_newwindow": toNewWin ? 2 : 3,
			"browser.block.target_new_window": toNewWin ? false : null,
			"dom.disable_open_during_load": false,
			"network.http.sendRefererHeader": this.getRefererPolicy(refererPolicy),
			"browser.tabs.loadDivertedInBackground": toNewWin ? null : loadInBackground
		});

		/****
		var origPrefs = this.setPrefs(
			toNewWin
				? {
					"browser.link.open_newwindow": 2,
					"browser.block.target_new_window": false,
					"dom.disable_open_during_load": false,
					"network.http.sendRefererHeader": this.getRefererPolicy(refererPolicy)
				}
				: {
					"browser.link.open_newwindow": 3,
					"browser.tabs.loadDivertedInBackground": loadInBackground,
					"dom.disable_open_during_load": false,
					"network.http.sendRefererHeader": this.getRefererPolicy(refererPolicy)
				}
		);
		****/
		node.click();

		if(origTarget)
			node.form.target = origTarget;
		else
			node.form.removeAttribute("target");
		this.restorePrefs(origPrefs);
	},
	fixTab: function(tab) {
		tab = tab || this.hc.item;
		if(!tab || !/^(?:\w+:)?tab$/.test(tab.nodeName)) // <tab> or <namespace:tab>
			tab = this.getTabBrowser().mCurrentTab;
		return tab;
	},
	removeOtherTabs: function(e, tab) {
		tab = this.fixTab(tab);
		this.getTabBrowser().removeAllTabsBut(tab);
	},
	removeAllTabs: function(e) {
		var tbr = this.getTabBrowser();
		if(this.warnAboutClosingTabs(null, tbr)) {
			var tabs = tbr.mTabContainer.childNodes;
			for(var i = tabs.length - 1; i >= 0; --i)
				tbr.removeTab(tabs[i]);
		}
	},
	removeRightTabs: function(e, tab) {
		tab = this.fixTab(tab);
		var tbr = this.getTabBrowser();
		var tabs = tbr.mTabContainer.childNodes;
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
		var tbr = this.getTabBrowser();
		var tabs = tbr.mTabContainer.childNodes;
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
		// chrome://browser/content/tabbrowser.xml
		// "warnAboutClosingTabs" method
		tbr = tbr || this.getTabBrowser();
		tabsToClose = typeof tabsToClose == "number"
			? tabsToClose
			: tbr.mTabContainer.childNodes.length;
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
			var messageKey = this.hc.fxVersion == 1.5
				? tabsToClose == 1 ? "tabs.closeWarningOne"    : "tabs.closeWarningMultiple"
				: tabsToClose == 1 ? "tabs.closeWarningOneTab" : "tabs.closeWarningMultipleTabs";
			var closeKey = tabsToClose == 1 ? "tabs.closeButtonOne" : "tabs.closeButtonMultiple";
			// focus the window before prompting.
			// this will raise any minimized window, which will
			// make it obvious which window the prompt is for and will
			// solve the problem of windows "obscuring" the prompt.
			// see bug #350299 for more details
			window.focus();
			var buttonPressed = pSvc.confirmEx(window,
				bundle.getString("tabs.closeWarningTitle"),
				bundle.getFormattedString(messageKey, [tabsToClose]),
				(pSvc.BUTTON_TITLE_IS_STRING * pSvc.BUTTON_POS_0)
				+ (pSvc.BUTTON_TITLE_CANCEL * pSvc.BUTTON_POS_1),
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
		this.getTabBrowser().removeTab(tab);
	},
	renameTab: function(e, tab) {
		tab = this.fixTab(tab);
		var lbl = this.ut.promptEx(
			this.ut.getLocalised("renameTab"),
			this.ut.getLocalised("tabNewName"),
			tab.label
		);
		tab.label = lbl == null
			? tab.linkedBrowser.contentDocument.title
				|| this.getTabBrowser(true).mStringBundle.getString("tabs.untitled")
			: lbl;
	},
	reloadAllTabs: function(e, skipCache) {
		var _this = this;
		this.forEachTab(
			function(tab) {
				_this.reloadTab(e, skipCache, tab);
			}
		);
	},
	reloadTab: function(e, skipCache, tab) {
		tab = this.fixTab(tab);
		var br = tab.linkedBrowser;
		if(skipCache)
			br.reloadWithFlags(
				nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY | nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE
			);
		else
			br.reload();
	},
	stopAllTabsLoading: function(e) {
		var _this = this;
		this.forEachTab(
			function(tab) { _this.stopTabLoading(e, tab); }
		);
	},
	stopTabLoading: function(e, tab) {
		tab = this.fixTab(tab);
		var br = tab.linkedBrowser;
		br.stop();
	},
	undoCloseTab: function(e) {
		try { gBrowser.undoRemoveTab(); } // Tab Mix Plus
		catch(err) { undoCloseTab(0); }
	},
	cloneTab: function(e, tab) {
		tab = this.fixTab(tab);
		var tbr = this.getTabBrowser();
		var ind = ++tab._tPos;
		if("duplicateTab" in tbr) // fx 3.0+
			var newTab = tbr.duplicateTab(tab);
		else // Not a real "clone"... Just URI's copy
			var newTab = tbr.addTab(this.getTabUri(tab));
		if("TreeStyleTabService" in window && ind == tbr.browsers.length - 1)
			tbr.moveTabTo(newTab, ind - 1); // Fix bug for last tab moving
		tbr.moveTabTo(newTab, ind);
		tbr.selectedTab = newTab;
	},
	reloadImg: function(e, img) {
		img = img || this.hc.item;
		var src = img.src;
		if(!src)
			return;
		var hasStyle = img.hasAttribute("style");
		var origStyle = img.getAttribute("style");
		var w = this.getStyle(img, "width");
		var h = this.getStyle(img, "height");
		img.style.width = w;
		img.style.height = h;
		// this.ut._log("reloadImg -> " + w + " x " + h);
		// if(parseInt(w) > 32 && parseInt(h) > 32)
		img.style.background = "url('resource://handyclicks-content/loading.gif') center no-repeat";
		img.setAttribute("src", "resource://handyclicks-content/spacer.gif"); // transparent gif 1x1
		setTimeout(
			function() {
				img.setAttribute("src", src);
				img.addEventListener(
					"load",
					function() {
						img.removeAttribute("style");
						if(hasStyle)
							img.setAttribute("style", origStyle);
						img.removeEventListener("load", arguments.callee, false);
					},
					false
				);
			},
			0
		);
	},
	getStyle: function(item, propName) {
		item = item || this.hc.item;
		return item.ownerDocument.defaultView.getComputedStyle(item, "")[propName];
	},
	openSimilarLinksInTabs: function(e, refererPolicy, a) {
		a = a || this.hc.item;
		var s = a.innerHTML;
		var onlyUnVisited = {};
		var cnf = this.ut.promptsSvc.confirmCheck(
			window, this.ut.getLocalised("title"),
			this.ut.getLocalised("openSimilarLinks"),
			this.ut.getLocalised("openOnlyVisited"), onlyUnVisited
		);
		if(!cnf)
			return;
		onlyUnVisited = onlyUnVisited.value;

		var doc = a.ownerDocument;

		// Based on code by Yan ( http://forum.mozilla-russia.org/viewtopic.php?pid=144109#p144109 )
		var ar = doc.getElementsByTagName("a");
		var hrefs = {};
		var his = Components.classes["@mozilla.org/browser/global-history;2"]
			.getService(Components.interfaces.nsIGlobalHistory2);
		var IO = Components. classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		var text, h;
		for(var i = 0, len = ar.length; i < len; i++) {
			text = ar[i].innerHTML;
			h = ar[i].href;
			if(
				text == s && h && !/^javascript:/i.test(h)
				&& (
					!onlyUnVisited || !his.isVisited(IO.newURI(h, null, null))
				)
			)
				hrefs[h] = 1;
		}
		var tbr = this.getTabBrowser(true);

		// Open a new tab as a child of the current tab (Tree Style Tab)
		if("TreeStyleTabService" in window)
			TreeStyleTabService.readyToOpenChildTab(tbr.selectedTab, true);

		var ref = this.getRefererForItem(refererPolicy);
		for(var h in hrefs)
			if(hrefs.hasOwnProperty(h))
				tbr.loadOneTab(h, ref, null, null, true, false);

		if("TreeStyleTabService" in window)
			TreeStyleTabService.stopToOpenChildTab(tbr.selectedTab);
	},
	$void: function(e) {}, // dummy function
	getRefererForItem: function(refPolicy, imgLoading, it) {
		if(typeof refPolicy == "undefined")
			refPolicy = -1;
		if(typeof imgLoading == "undefined")
			imgLoading = false;
		it = it || this.hc.item;
		var oDoc = it.ownerDocument;
		if(!this.ut.isNoChromeDoc(oDoc))
			return null;
		refPolicy = this.getRefererPolicy(refPolicy);
		// http://kb.mozillazine.org/Network.http.sendRefererHeader
		// 0 - none
		// 1 - for docs
		// 2 - for images and docs
		return (refPolicy == 1 && !imgLoading) || refPolicy == 2
			? makeURI(oDoc.location.href) // see chrome://global/content/contentAreaUtils.js
			: null;
	},
	getRefererPolicy: function(refPolicy) {
		if(typeof refPolicy == "undefined")
			refPolicy = -1;
		return refPolicy == -1
			? this.pu.getPref("network.http.sendRefererHeader")
			: refPolicy;
	},
	showContextMenu: function(e) {
		this.hc.showPopupOnItem();
	},
	tooltipAttrBase: "hc_tooltip_",
	fillInTooltip: function(tooltip) {
		var tNode = document.tooltipNode;
		var attrBase = this.tooltipAttrBase;
		var i = 0, lbl;
		var attrName = attrBase + i;
		while(tNode.hasAttribute(attrName)) {
			lbl = tooltip["_" + attrName];
			if(!lbl) {
				lbl = document.createElement("label");
				lbl.setAttribute("crop", "center");
				tooltip.firstChild.appendChild(lbl);
				tooltip["_" + attrName] = lbl;
			}
			lbl.setAttribute("value", tNode.getAttribute(attrName));
			lbl.hidden = false;
			attrName = attrBase + ++i;
		}
		return tNode.hasAttribute("hc_tooltip_0");
	},
	hideAllLabels: function(tooltip) {
		var chs = tooltip.firstChild.childNodes;
		for(var i = 0, len = chs.length; i < len; i++)
			chs[i].hidden = true;
	}
};
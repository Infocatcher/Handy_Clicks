var handyClicksFuncs = {
	ut: handyClicksUtils, // shortcut
	hc: handyClicks, // shortcut
	voidURI: /^javascript:(\s|%20)*(|\/\/|void(\s|%20)*((\s|%20)+0|\((\s|%20)*0(\s|%20)*\)))(\s|%20)*;?$/i,
	promptsServ: Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService),
	relativeIndex: 0,
	_defaultCharset: null,
	copyItemText: function(e) { // for all
		var text = this.hc.itemType == "tabbar"
			? this.forEachTab(this.getTabUri).join("\n")
			: this.getTextOfCurrentItem();
		this.ut._log("copyItemText -> " + text);
		this.copyStr(text);
		this.hc.blinkNode();
	},
	copyItemLink: function(e) {
		var link = this.hc.itemType == "tabbar"
			? this.forEachTab(function(tab) { return tab.label; }).join("\n")
			: this.getUriOfItem() || "";
		this.ut._log("copyItemLink -> " + link);
		this.copyStr(link);
		this.hc.blinkNode();
	},
	getTextOfCurrentItem: function() {
		var it = this.hc.item;
		return it.textContent || it.label || it.alt || it.value || "";
	},
	getUriOfItem: function(it) {
		var it = it || this.hc.item;
		var uri = null;
		switch(this.hc.itemType) {
			case "link":
				uri = it.href;
			break;
			case "img":
				this.ut._log("getUriOfItem -> img -> !it.src && it.hasAttribute(\"src\") -> " + (!it.src && it.hasAttribute("src")));
				uri = it.src || it.getAttribute("src");
			break;
			case "bookmark":
			case "historyItem":
				uri = this.getBookmarkUri(it);
			break;
			case "tab":
				uri = this.getTabUri(it);
		}
		return uri;
	},
	getBookmarkUri:	function(it, usePlacesURIs) {
		var uri = it.statusText || (it.node && it.node.uri) || it.getAttribute("siteURI") || "";
		return !usePlacesURIs && /^place:/.test(uri) ? "" : uri;
	},
	getTabUri: function(tab) {
		return tab.linkedBrowser.contentDocument.location.href;
	},
	forEachTab: function(fnc, tbr) {
		var res = [];
		var tbr = tbr || this.getTabBrowser(true);
		var tabs = tbr.mTabContainer.childNodes;
		for(var i = 0, len = tabs.length; i < len; i++) {
			if(tabs[i])
				res.push(fnc(tabs[i]));
			else
				alert(tabs[i]);
		}
		return res;
	},
	copyStr: function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str);
	},
	openUriInCurrentTab: function(e, refererPolicy, uri) {
		uri = uri || this.getUriOfItem(this.hc.item);
		if(this.testForHighlander(uri))
			return;
		this.getTabBrowser().loadURI(uri, this.getRefererForItem(refererPolicy));
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
		return false
	},
	openUriInTab: function(e, loadInBackground, refererPolicy, moveTo) { //~ todo: move, etc.
		var tbr = this.getTabBrowser(true);
		if(moveTo == "relative") {
			var tabCont = tbr.mTabContainer;
			tabCont.__handyClicks__resetRelativeIndex = false;
		}
		var tab = this._openUriInTab(loadInBackground, refererPolicy, e, moveTo);
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
				this.ut._error("[Handy Clicks]: openUriInTab -> invalid moveTo argument: " + moveTo);
				return;
		}
		if("TreeStyleTabService" in window && (moveTo == "after" || moveTo == "relative") && ind == tbr.browsers.length - 1)
			tbr.moveTabTo(tab, ind - 1); // Fix bug for last tab moving
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
		tabCont.addEventListener("select", _resetRelativeIndex, true);
		window.addEventListener(
			"unload",
			function(e) {
				tabCont.__handyClicks__listeners = false;
				tabCont.removeEventListener(e.type, arguments.callee, false);
				tabCont.removeEventListener("TabClose", _resetRelativeIndex, true);
				tabCont.removeEventListener("select", _resetRelativeIndex, true);
			},
			false
		);
	},
	_openUriInTab: function(loadInBackground, refererPolicy, e, moveTo, item, uri) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getUriOfItem(item);
		if(this.testForLinkFeatures(loadInBackground, refererPolicy, e, item, uri))
			return null;
		var tbr = this.getTabBrowser(true);
		// Open a new tab as a child of the current tab (Tree Style Tab)
		// http://piro.sakura.ne.jp/xul/_treestyletab.html.en#api
		if( !moveTo && this.ut.isNoChromeDoc(item.ownerDocument) && "TreeStyleTabService" in window)
			TreeStyleTabService.readyToOpenChildTab(tbr.selectedTab);
		return tbr.loadOneTab(
			uri,
			this.getRefererForItem(refererPolicy, false, item),
			null, null,
			loadInBackground,
			false
		);
	},
	testForLinkFeatures: function(loadInBackground, refererPolicy, e, item, uri) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getUriOfItem(item);
		if(/^javascript:/i.test(uri)) {
			this.loadJavaScriptLink(loadInBackground, refererPolicy, e, item, uri);
			return true;
		}
		if(this.testForFileLink(refererPolicy, uri) || this.testForHighlander(uri))
			return true;
		return false;
	},
	loadJavaScriptLink: function(loadInBackground, refererPolicy, e, item, uri) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getUriOfItem(item);
		if( // void links with handlers
			this.hc.itemType == "link"
			&& (!uri || this.voidURI.test(uri))
			&& (
				item.hasAttribute("onclick")
				|| item.hasAttribute("onmousedown")
				|| item.hasAttribute("onmouseup")
			)
		)
			this.loadVoidLinkWithHandler(loadInBackground, refererPolicy);
		else
			this.loadNotVoidJavaScriptLink(loadInBackground, refererPolicy);
	},
	loadVoidLinkWithHandler: function(loadInBackground, refererPolicy, e, item) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		if(this.hc.getPref("notifyVoidLinksWithHandlers"))
			this.hc.notify(
				this.ut.getLocalised("title"),
				this.ut.getLocalised("voidLinkWithHandler")
			);
		var evt = document.createEvent("MouseEvents"); // thanks to Tab Scope!
		evt.initMouseEvent(
			"click", true, false, item.ownerDocument.defaultView, 1,
			e.screenX, e.screenY, e.clientX, e.clientY,
			false, false, false, false,
			0, null
		);
		var origPrefs = this.setPrefs({
			"browser.tabs.loadDivertedInBackground": loadInBackground,
			"network.http.sendRefererHeader": this.getRefererPolicy(refererPolicy)
		});
		item.dispatchEvent(evt);
		this.restorePrefs(origPrefs);
	},
	loadNotVoidJavaScriptLink: function(loadInBackground, refererPolicy, item, uri) {
		item = item || this.hc.item;
		uri = uri || this.getUriOfItem(item);
		if(this.hc.getPref("notifyJavaScriptLinks"))
			this.hc.notify(
				this.ut.getLocalised("title"),
				this.ut.getLocalised("javaScriptLink")
			);
		var origPrefs = this.setPrefs({
			"dom.disable_open_during_load": false, // allow window.open( ... )
			"browser.tabs.loadDivertedInBackground": loadInBackground,
			"network.http.sendRefererHeader": this.getRefererPolicy(refererPolicy)
		});

		var oDoc = item.ownerDocument;
		if(this.ut.isNoChromeDoc(oDoc))
			oDoc.location.href = uri;
		else
			this.getTabBrowser().loadURI(uri); // bookmarklets

		this.restorePrefs(origPrefs);
	},
	testForFileLink: function(refererPolicy, uri) {
		uri = uri || this.getUriOfItem(this.hc.item);
		var filesPolicy = this.hc.getPref("filesLinksPolicy");
		if(filesPolicy < 1)
			return false;
		var regexp = this.hc.getPref("filesLinksMask"); //~ todo: UTF-8
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
			this.alertWithTitle(
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("RegExpError").replace("%RegExp%", regexp) + e
			);
		}
		return false;
	},
	openUriInWindow: function(e, loadInBackground, refererPolicy, moveTo) {
		var win = this._openUriInWindow(loadInBackground, refererPolicy, e);
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
				this.ut._error("[Handy Clicks]: openUriInWindow -> invalid moveTo argument: " + moveTo);
				return;
		}
		if(xCur !== undefined && yCur !== undefined)
			window.moveTo(xCur, yCur);
		if(wCur !== undefined && hCur !== undefined)
			window.resizeTo(wCur, hCur);
		this.initWindowMoving(win, xNew, yNew, wNew, hNew);
	},
	_openUriInWindow: function(loadInBackground, refererPolicy, e, item, uri) {
		e = e || this.hc.copyOfEvent;
		item = item || this.hc.item;
		uri = uri || this.getUriOfItem(item);
		if(this.testForLinkFeatures(loadInBackground, refererPolicy, e, item, uri))
			return null;
		var win = window.openDialog(
			getBrowserURL(),
			"_blank",
			"chrome,all,dialog=no" + (loadInBackground ? ",alwaysLowered" : ""), // Thanks to All-in-One Gestures!
			uri, null,
			this.getRefererForItem(refererPolicy), null, false
		);
		if(loadInBackground)
			this.initRestoringOfZLevel(win);
		return win;
	},
	initRestoringOfZLevel: function(win) {
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
	openInSidebar: function(e, ttl, uri) {
		ttl = ttl || "";
		uri = uri || this.getUriOfItem(this.hc.item);
		openWebPanel(ttl, uri);
	},
	getTabBrowser: function(tabsRequired) {
		return "SplitBrowser" in window && !(tabsRequired && "TM_init" in window) // Tab Mix Plus
			? SplitBrowser.activeBrowser
			: gBrowser || getBrowser();
	},
	downloadWithFlashGot: function(e, item) {
		item = item || this.hc.item;
		if(typeof gFlashGot == "undefined") {
			this.ut._error("[Total Clicks]: missing FlashGot extension ( https://addons.mozilla.org/firefox/addon/220 )");
			return;
		}
		document.popupNode = item;
		gFlashGot.downloadPopupLink();
	},
	openInSplitBrowser: function(e, position, uri, win) {
		position = (position || "bottom").toUpperCase();
		uri = uri || this.getUriOfItem(this.hc.item);
		win = win || this.hc.item.ownerDocument.defaultView;
		if(typeof SplitBrowser == "undefined") {
			this.ut._error("[Total Clicks]: missing Split Browser extension ( https://addons.mozilla.org/firefox/addon/4287 )");
			return;
		}
		SplitBrowser.addSubBrowser(uri, null, SplitBrowser["POSITION_" + position]);
	},
	alertWithTitle: function(ttl, txt) {
		this.promptsServ.alert(window, ttl, txt);
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
			if(typeof attrs[p] != "string" || p.indexOf("__") == 0)
				item[p] = attrs[p]; // not works for "oncommand"
			else
				item.setAttribute(p, attrs[p]);
		}
	},


	///////////////////
	_test_old: function(e) { //~ del
		this.ut._log("_test");
		var items = [
			{ label: "Label - 0", oncommand: "alert(this.label);" },
			{},
			{ label: "Label - 1", onclick: function() { alert(this.label); } },
			{ label: "Label - 2", oncommand: "alert(this.label);", mltt_line_0: "line-0" },
			{ label: "Label - 2", oncommand: "alert(this.label);", mltt_line_0: "line-0", mltt_line_1: "line-1" },
		];
		this.showGeneratedPopup(items);
	},
	_test: function(e) {
		var items = [
			{ label: "Label - 0" },
			{},
			{ label: "Label - 1" },
			{ label: "Label - 2" },
			{ label: "Label - 3" },
			[
				{ label: "Menu - 4" },
				[
					{ label: "Label - 4 - 0" },
					[
						{ label: "Menu - 4 - 1" },
						[
							{ label: "Label - 4 - 1 - 1" }
						]
					],
					{ label: "Label - 4 - 1" },
					{ label: "Label - 4 - 2" }
				]
			]
		];
		var popup = this.showGeneratedPopup(items);
		popup.setAttribute("oncommand", "alert(event.target.label);");
	},
	///////////////////

	get profileDir() {
		if(!this._profileDir)
			this._profileDir = handyClicksPrefServ.profileDir
				.path.replace(/[\\\/]$/, "");
		return this._profileDir;
	},
	getRelativePath: function(path) {
		var pathArr = path.match(/^%profile%([\/\\])((?:\.\.[\/\\])*)(.*)$/);
		if(pathArr) {
			var pathBegin = this.profileDir + pathArr[1];
			var pathEnd = pathArr[3];
			if(pathArr[2]) {
				var len = pathArr[2].match(/\.\.[\/\\]/g);
				if(len && len.length) {
					var pathBeginNew = pathBegin.replace(new RegExp("([^\\/\\\\]+[\\/\\\\]){" + len.length + "}$"), "");
					if(pathBeginNew == pathBegin) {
						this.ut._error("[Total Clicks]: invalid relative path:\n" + patch);
						return null;
					}
					else
						pathBegin = pathBeginNew;
				}
			}
			return pathBegin + pathEnd;
		}
		else
			return path;
	},
	startProcess: function(path, args) {
		args = args || [];
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(path);
		if(!file.exists()) {
			alert(path + "\nnot found!"); //~todo: promptsService
			return;
		}
		var process = Components.classes["@mozilla.org/process/util;1"]
			.getService(Components.interfaces.nsIProcess);
		process.init(file);
		process.run(false, args, args.length);
	},
	get defaultCharset() { // thanks to IE Tab!
		if(this._defaultCharset == null) {
			var strBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
				.getService(Components.interfaces.nsIStringBundleService);
			try {
				this._defaultCharset = strBundle.createBundle("chrome://global-platform/locale/intl.properties")
					.GetStringFromName("intl.charset.default");
			}
			catch(e) {
				this._defaultCharset = "";
			}
		}
		return this._defaultCharset;
	},
	get charset() {
		var charset = "";
		if(this.hc.getPref("convertURIs")) {
			charset = this.hc.getPref("convertURIsTo");
			if(!charset) {
				charset = navigator.preference("intl.charset.default");
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
		if(!uri) { //~ todo: show pop-up massage
			return;
		}
		var path, it, n, args;
		for(var i = 0; i < items.length; i++) {
			it = items[i], n = 0;
			path = it.__path;
			if(path) {
				path = this.getRelativePath(path);
				it.class = "menuitem-iconic";
				it.image = "moz-icon:file://" + path;
				it["mltt_line_" + n++] = path;
				it.__path = path;
			}
			if(it.__args instanceof Array) {
				args = it.__args;
				for(var j = 0; j < args.length; j++)
					it["mltt_line_" + n++] = args[j];
			}
			it["mltt_line_" + n++] = this.decodeUri(uri);
		}
		var popup = this.showGeneratedPopup(items);
		popup.setAttribute("oncommand", "handyClicksFuncs.openUriWithApp(event, this);");
		popup.__uri = this.convertStrFromUnicode(uri);
	},

	///////////////////
	_test_showOpenUriWithAppsPopup: function(e) { //~ del
		var items = [
			{ label: "Opera 9.5x", __path: "c:\\Program Files\\Opera 9.5\\opera.exe" },
			{ label: "IE 7.0", __path: "c:\\Program Files\\Internet Explorer\\iexplore.exe" },
			{},
			{ label: "Firefox 2.0.0.x - test", __path: "c:\\Program Files\\Mozilla Firefox 2.0.0.x\\firefox.exe",
				__args: ["-no-remote", "-p", "fx2.0"] },
			{ label: "OperaUSB", __path: "%profile%\\..\\..\\..\\..\\OperaUSB\\op.com" }
		];
		this.showOpenUriWithAppsPopup(items);
	},
	///////////////////

	setPrefs: function(prefsObj) { //~ warn: not for UTF-8 prefs!
		var origs = {};
		for(var p in prefsObj) {
			origs[p] = navigator.preference(p);
			navigator.preference(p, prefsObj[p]);
		}
		return origs;
	},
	restorePrefs: function(prefsObj) {
		for(var p in prefsObj)
			navigator.preference(p, prefsObj[p]); //~ todo: test! (setTimeout for fx3 ?)
	},
	submitFormToNewDoc: function(e, toNewWin, loadInBackground, refererPolicy, node) {
		// Thanks to SubmitToTab! ( https://addons.mozilla.org/firefox/addon/483 )
		node = node || this.hc.item;
		node = new XPCNativeWrapper(node, "form", "click()");
		var origTarget = node.form.getAttribute("target");
		node.form.target = "_blank";

		var origPrefs = this.setPrefs( //~ todo: refererPolicy
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
		node.click();

		if(origTarget)
			node.form.target = origTarget;
		else
			node.form.removeAttribute("target");
		node.form.target = origTarget ? origTarget : "_self"; //~ todo: removeAttribute ?
		this.restorePrefs(origPrefs);
	},
	removeOtherTabs: function(e, tab) {
		tab = tab || this.hc.item;
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
		var tbr = this.getTabBrowser();
		tab = tab || (this.hc.itemType == "tab" && this.hc.item) || tbr.mCurrentTab;;
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
		var tbr = this.getTabBrowser();
		tab = tab || (this.hc.itemType == "tab" && this.hc.item) || tbr.mCurrentTab;;
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
			var promptsServ = this.promptsServ;
			// default to true: if it were false, we wouldn't get this far
			var warnOnClose = { value: true };
			var bundle = tbr.mStringBundle;
			var messageKey = this.hc.isFx(1)
				? tabsToClose == 1 ? "tabs.closeWarningOne"    : "tabs.closeWarningMultiple"
				: tabsToClose == 1 ? "tabs.closeWarningOneTab" : "tabs.closeWarningMultipleTabs";
			var closeKey = tabsToClose == 1 ? "tabs.closeButtonOne" : "tabs.closeButtonMultiple";
			// focus the window before prompting.
			// this will raise any minimized window, which will
			// make it obvious which window the prompt is for and will
			// solve the problem of windows "obscuring" the prompt.
			// see bug #350299 for more details
			window.focus();
			var buttonPressed = promptsServ.confirmEx(window,
				bundle.getString("tabs.closeWarningTitle"),
				bundle.getFormattedString(messageKey, [tabsToClose]),
				(promptsServ.BUTTON_TITLE_IS_STRING * promptsServ.BUTTON_POS_0)
				+ (promptsServ.BUTTON_TITLE_CANCEL * promptsServ.BUTTON_POS_1),
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
	renameTab: function(e, tab) {
		tab = tab || this.hc.item;
		var lbl = prompt("New name:", tab.label); //~ todo: promptsService
		tab.label = lbl === null
			? tab.linkedBrowser.contentDocument.title || this.getTabBrowser(true).mStringBundle.getString("tabs.untitled")
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
		tab = tab || this.hc.item;
		var br = tab.linkedBrowser;
		if(skipCache)
			br.reloadWithFlags(
				nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY | nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE
			);
		else
			br.reload();
	},
	undoCloseTab: function(e) {
		try { gBrowser.undoRemoveTab(); } // Tab Mix Plus
		catch(err) { undoCloseTab(0); }
	},
	cloneTab: function(e, tab) {
		var tbr = this.getTabBrowser();
		tab = tab || tbr.mCurrentTab;
		var ind = ++tab._tPos;
		try { // fx 3.0
			var newTab = tbr.duplicateTab(tab);
		}
		catch(err) {
			var newTab = tbr.addTab(this.getTabUri(tab));
		}
		if("TreeStyleTabService" in window && ind == tbr.browsers.length - 1)
			tbr.moveTabTo(newTab, ind - 1); // Fix bug for last tab moving
		tbr.moveTabTo(newTab, ind);
		tbr.selectedTab = newTab;
	},
	reloadImg: function(e, img) {
		img = img || this.hc.item;
		var src = img.src || img.getAttribute("src"); // ?
		if(!src)
			return;
		var hasStyle = img.hasAttribute("style");
		var origStyle = img.getAttribute("style");
		var w = this.getComputedStyleOfItem("width");
		var h = this.getComputedStyleOfItem("height");
		img.style.width = w;
		img.style.height = h;
		this.ut._log("reloadImg -> " + w + " x " + h);
		// if(parseInt(w) > 32 && parseInt(h) > 32)
		img.style.background = "url('chrome://handyclicks/content/loading.gif') center no-repeat";
		img.setAttribute("src", "chrome://handyclicks/content/spacer.gif"); // transparent gif 1x1
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
	getComputedStyleOfItem: function(name, item) {
		item = item || this.hc.item;
		return item.ownerDocument.defaultView.getComputedStyle(item, "")[name];
	},
	openSimilarLinksInTabs: function(e, refererPolicy, a) {
		a = a || this.hc.item;
		var s = a.innerHTML;
		var onlyUnVisited = {};
		var cnf = this.promptsServ.confirmCheck(
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
			tbr.loadOneTab(h, ref, null, null, true, false);

		if("TreeStyleTabService" in window)
			TreeStyleTabService.stopToOpenChildTab(tbr.selectedTab);
	},
	getRefererForItem: function(refPolicy, imgLoading, it) {
		if(typeof refPolicy == "undefined")
			refPolicy = -1;
		if(typeof imgLoading == "undefined")
			imgLoading = false;
		it = it || this.hc.item;
		var oDoc = it.ownerDocument;
		if(!this.ut.isNoChromeDoc(oDoc))
			return null;
		var refPolicy = this.getRefererPolicy(refPolicy);
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
			? navigator.preference("network.http.sendRefererHeader")
			: refPolicy;
	},
	showContextMenu: function(e) {
		this.hc.showPopupOnItem();
	},
	fillInTooltip: function(tooltip) {
		var tNode = document.tooltipNode;
		var attrName = "mltt_line_0";
		var i = 0, lbl;
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
			attrName = "mltt_line_" + ++i;
		}
		return tNode.hasAttribute("mltt_line_0");
	},
	hideAllLabels: function(tooltip) {
		var chs = tooltip.firstChild.childNodes;
		for(var i = 0, len = chs.length; i < len; i++)
			chs[i].hidden = true;
	}
};
var handyClicksPrefs = {
	"button=0,ctrl=true,shift=false,alt=false,meta=false": {
		link: { },
		img: { },
		bookmark: { },
		historyItem: { },
		tab: { }
	}
};

/*
{
	enabled: true,
	action: "...",
	custom: false,
	arguments: { loadInBackground: true, sendReferer: false }
}

// { loadInBackground: true, sendReferer: false } => [true, false]



var funcs = {
	openInTab: {
		supports: "link,img,bookmark,historyItem", // /(^|,)link(,|$)/
		args: ["loadInBackground", "sendReferer"]
	},
	openInSidebar: {
		supports: "link,img,bookmark,historyItem",
		args: []
	}
};
supports: function(feature, str) {
	return new RegExp("(^|,)" + feature + "(,|$)").test(str);
}





testcase:
javascript: var img = document.createElement("img"); img.src = "http://ya.ru/1.png"; img.alt = "[img]"; document.body.appendChild(img); void(0);

*/
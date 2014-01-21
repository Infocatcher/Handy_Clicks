Provides more clicks options: you can set some built-in action (or write any custom action) for click (right-click, Shift+left-click, etc.) on some items like links (or you can add detect function for any other items).

#### Historical notes
This is very old project (version 0.0.1.0a1 was created at 2008-08-28), it contain many obsolete codes (especially due to removed <a href="https://developer.mozilla.org/en-US/docs/E4X">E4X</a>), supports only clicks inside main browser window and contains many features, that not tested in new browser versions. Unfortunately I don't have enough free time to debug and make something release-like, so finally I decided to make it public “as is”.
<br>Some old version and (also old) examples can be found <a href="http://infocatcher.ucoz.net/ext/fx/handy_clicks/hc_releases.html">here</a>.

#### Options
* <em>handyclicks/</em> directory in browser <a href="http://kb.mozillazine.org/Profile_folder">profile</a>
* <em>extensions.handyclicks.</em>* branch in <a href="http://kb.mozillazine.org/About:config">about:config</a> page

#### Hotkeys
Note: some hotkeys described in the interface and not listed here.
<br>Hotkeys for browser window can be changed using <em>extensions.handyclicks.key.</em>* preferences on about:config page.

##### Hotkeys in settings windows
<table>
<tr><td>F5, Ctrl+R            </td><td>Reload (load saved settings)        </td></tr>
<tr><td>Ctrl+Shift+J          </td><td>Open error console                  </td></tr>
<tr><td>F10                   </td><td>Maximize/restore window             </td></tr>
<tr><td>F11                   </td><td>Toggle fullscreen mode              </td></tr>
</table>

##### Hotkeys in code editor
<table>
<tr><td>Tab                   </td><td>indent selected lines using tabs    </td></tr>
<tr><td>Shift+Tab             </td><td>unindent selected lines using tabs  </td></tr>
<tr><td>Space                 </td><td>indent selected lines using spaces  </td></tr>
<tr><td>Shift+Tab             </td><td>unindent selected lines using spaces</td></tr>
<tr><td>Ctrl+Shift+Q          </td><td>Comment/uncomment                   </td></tr>
<tr><td>Ctrl+Shift+A          </td><td>Comment/uncomment at line start     </td></tr>
<tr><td>Alt+Backspace         </td><td>Trim trailing spaces                </td></tr>
<tr><td>Ctrl+G, Ctrl+L, Ctrl+J</td><td>Go to line                          </td></tr>
<tr><td>Ctrl++                </td><td>Increase font size                  </td></tr>
<tr><td>Ctrl+-                </td><td>Decrease font size                  </td></tr>
<tr><td>Ctrl+0                </td><td>Reset font size                     </td></tr>
<tr><td>Ctrl+W                </td><td>Toggle word wrap                    </td></tr>
<tr><td>F12                   </td><td>Toggle “fullwindow” mode            </td></tr>
<tr><td>Ctrl+Shift+E, F4*     </td><td>Open in external editor             </td></tr>
<tr><td>Ctrl+O*               </td><td>Load code from file                 </td></tr>
<tr><td>Ctrl+Shift+O*         </td><td>Load code from file and sync changes</td></tr>
<tr><td>Ctrl+Shift+S*         </td><td>Save code to file                   </td></tr>
</table>
\* – “global” hotkey, works even if editor field isn't focused.
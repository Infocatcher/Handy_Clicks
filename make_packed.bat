@echo off
set _out=handy_clicks-latest-packed.xpi
set _tmpDir=%~d0\~%_out%.tmp
set _jar=handyclicks.jar

set _7zip="%COMMANDER_PATH%\arch\7-Zip-4.65\7z.exe"
set _winRar="%COMMANDER_PATH%\arch\WinRAR\WinRAR.exe"

if not exist %_7zip% set _7zip="%ProgramFiles%\7-Zip\7z.exe"
if not exist %_winRar% set _winRar="%ProgramFiles%\WinRAR\WinRAR.exe"

if not exist %_7zip% (
	echo 7-Zip not found!
	if not exist %_winRar% (
		echo WinRAR not found!
		pause
		exit /b
	)
)

if exist %_tmpDir% (
	echo Error: found %_tmpDir% directory, please remove/rename it first!
	pause
	exit /b
)

cd /d "%~dp0"

set _files=install.rdf *.manifest *.js *.jsm *.xul *.xml *.html license* *.png defaults modules components locale chrome idl

md %_tmpDir%
xcopy /e * %_tmpDir%

del /q %_tmpDir%\*.xpi
del /q %_tmpDir%\*.bat
del /q %_tmpDir%\chrome\%_jar%
move /y %_tmpDir%\chrome_.manifest %_tmpDir%\chrome.manifest

:: Copy last modified time of directories
xcopy /e /t /y * %_tmpDir%

if exist %_7zip% (
	echo =^> %_7zip%
	%_7zip% a -tzip -mx0 -- %_tmpDir%\chrome\%_jar% %_tmpDir%\chrome\content %_tmpDir%\chrome\skin %_tmpDir%\chrome\locale
) else (
	echo =^> %_winRar%
	%_winRar% a -afzip -m0 -r -- %_tmpDir%\chrome\%_jar% %_tmpDir%\chrome\content %_tmpDir%\chrome\skin %_tmpDir%\chrome\locale
)

rd /s /q %_tmpDir%\chrome\locale
rd /s /q %_tmpDir%\chrome\skin
rd /s /q %_tmpDir%\chrome\content

pushd %_tmpDir%
if exist %_7zip% (
	echo =^> %_7zip%
	%_7zip% a -tzip -mx9 -mfb=258 -mpass=15 -- %_out% %_files%
) else (
	echo =^> %_winRar%
	%_winRar% a -afzip -m5 -r -- %_out% %_files%
)
if not exist %_out% echo Error: %_out% not found! & pause & exit /b
popd


move /y %_tmpDir%\%_out% %_out%
rd /s /q %_tmpDir%
Unicode true
ManifestDPIAware true
RequestExecutionLevel admin
!ifndef VERSION
  !define VERSION "1.4.0"
!endif

Name "Controlador de Maquetes by Quiral & Co. Platinum"
Caption "Instal·lador de Quiral & Co. Platinum"
OutFile "dist\Controlador-de-Maquetes-Quiral-Platinum-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES64\Quiral & Co.\Controlador de Maquetes Platinum"
InstallDirRegKey HKLM "Software\Quiral & Co.\Controlador de Maquetes Platinum" "InstallDir"
ShowInstDetails show
ShowUnInstDetails show

!include "MUI2.nsh"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Catalan"

Section "Aplicació nativa Quiral Control" SEC_APP
  SetOutPath "$INSTDIR"
  File /r "publish\*.*"

  CreateDirectory "$SMPROGRAMS\Quiral & Co."
  CreateShortCut "$SMPROGRAMS\Quiral & Co.\Controlador de Maquetes Platinum.lnk" "$INSTDIR\Quiral.ControladorMaquetes.exe"
  CreateShortcut "$DESKTOP\Controlador de Maquetes Platinum.lnk" "$INSTDIR\Quiral.ControladorMaquetes.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Quiral & Co.\Controlador de Maquetes Platinum" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "DisplayName" "Controlador de Maquetes by Quiral & Co. Platinum"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "DisplayVersion" "${VERSION}"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\Quiral & Co.\Controlador de Maquetes Platinum.lnk"
  RMDir "$SMPROGRAMS\Quiral & Co."
  Delete "$DESKTOP\Controlador de Maquetes Platinum.lnk"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "Software\Quiral & Co.\Controlador de Maquetes Platinum"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum"
SectionEnd

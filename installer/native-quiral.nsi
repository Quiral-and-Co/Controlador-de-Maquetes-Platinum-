Unicode true
ManifestDPIAware true
RequestExecutionLevel admin
SetRegView 64

!ifndef VERSION
  !define VERSION "1.4.1"
!endif
!ifndef PUBLISH_DIR
  !define PUBLISH_DIR "..\publish"
!endif
!ifndef OUTPUT_FILE
  !define OUTPUT_FILE "..\dist\ControladorDeMaquetes_Platinum_Edition_Setup-${VERSION}.exe"
!endif

Name "Controlador de Maquetes Platinum Edition"
Caption "Instal·lador de Controlador de Maquetes Platinum Edition"
OutFile "$\{OUTPUT_FILE}"
InstallDir "$PROGRAMFILES64\Quiral and Co.\Controlador de Maquetes Platinum Edition"
InstallDirRegKey HKLM "Software\Quiral and Co.\Controlador de Maquetes Platinum Edition" "InstallDir"
ShowInstDetails show
ShowUnInstDetails show

!include "MUI2.nsh"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

Var OldInstallDir
Var UpgradeBackup

!insertmacro MUI_LANGUAGE "Catalan"
!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  !insertmacro MUI_LANGDLL_DISPLAY
  StrCpy $UpgradeBackup "$TEMP\QuiralControl-UserData-${VERSION}.zip"
FunctionEnd

Section "Aplicació nativa" SEC_APP
  ReadRegStr $OldInstallDir HKLM "Software\Quiral and Co.\Controlador de Maquetes Platinum Edition" "InstallDir"
  IfFileExists "$OldInstallDir\Uninstall.exe" 0 +5
    SetOutPath "$PLUGINSDIR"
    File /oname=upgrade-preserve-data.ps1 "installer\upgrade-preserve-data.ps1"
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\upgrade-preserve-data.ps1" -Action Backup -DataDirectory "$LOCALAPPDATA\QuiralCo\ControladorDeMaquetes" -BackupFile "$UpgradeBackup"' $0
    IntCmp $0 0 +2
      Abort "No s'ha pogut verificar la còpia de seguretat. La versió anterior es manté instal·lada."
    ExecWait '"$OldInstallDir\Uninstall.exe" /S' $0
    IntCmp $0 0 +2
      Abort "La desinstal·lació de la versió anterior ha fallat. Actualització aturada."

  SetOutPath "$INSTDIR"
  File /r "${PUBLISH_DIR}\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  IfFileExists "$UpgradeBackup" 0 data_restore_done
    SetOutPath "$PLUGINSDIR"
    File /oname=upgrade-preserve-data.ps1 "installer\upgrade-preserve-data.ps1"
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\upgrade-preserve-data.ps1" -Action Restore -DataDirectory "$LOCALAPPDATA\QuiralCo\ControladorDeMaquetes" -BackupFile "$UpgradeBackup"' $0
    IntCmp $0 0 data_restore_done
      Abort "No s'han pogut restaurar les dades. La còpia s'ha conservat a: $UpgradeBackup"
    Delete "$UpgradeBackup"
  data_restore_done:

  CreateDirectory "$SMPROGRAMS\Quiral and Co."
  CreateShortCut "$SMPROGRAMS\Quiral and Co.\Controlador de Maquetes Platinum Edition.lnk" "$INSTDIR\Quiral.ControladorMaquetes.exe"
  CreateShortCut "$DESKTOP\Controlador de Maquetes Platinum Edition.lnk" "$INSTDIR\Quiral.ControladorMaquetes.exe"

  WriteRegStr HKLM "Software\Quiral and Co.\Controlador de Maquetes Platinum Edition" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "DisplayName" "Controlador de Maquetes Platinum Edition"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "Publisher" "Quiral and Co."
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "DisplayVersion" "${VERSION}"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\Quiral and Co.\Controlador de Maquetes Platinum Edition.lnk"
  RMDir "$SMPROGRAMS\Quiral and Co."
  Delete "$DESKTOP\Controlador de Maquetes Platinum Edition.lnk"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "Software\Quiral and Co.\Controlador de Maquetes Platinum Edition"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuiralControlPlatinum"
SectionEnd

[CmdletBinding(SupportsShouldProcess=$true)]param()
& "$PSScriptRoot/control-uptimerobot.ps1" -Action Start -WhatIf:$WhatIfPreference

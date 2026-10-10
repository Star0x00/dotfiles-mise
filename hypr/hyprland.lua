-- This is an example Hyprland Lua config file.
-- Refer to the wiki for more information.
-- https://wiki.hypr.land/Configuring/Start/

-- Please note not all available settings / options are set here.
-- For a full list, see the wiki

-- You can (and should!!) split this configuration into multiple files
-- Create your files separately and then require them like this:
-- require("myColors")

require("modules.monitors")
require("modules.autostart")
require("modules.env")
require("modules.permissions")
require("modules.appearance")
require("modules.input")
require("modules.keybindings")
require("modules.window-rules")

-- Theme colors are set manually to Catppuccin Mocha in modules/appearance.lua.

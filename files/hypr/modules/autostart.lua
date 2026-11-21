-------------------
---- AUTOSTART ----
-------------------

-- See https://wiki.hypr.land/Configuring/Basics/Autostart/

-- Autostart necessary processes (like notifications daemons, status bars, etc.)
-- Or execute your favorite apps at launch like this:
--
-- hl.on("hyprland.start", function ()
--   hl.exec_cmd(terminal)
--   hl.exec_cmd("nm-applet")
--   hl.exec_cmd("waybar & hyprpaper & firefox")
-- end)

hl.on("hyprland.start", function()
	hl.exec_cmd("noctalia")
	hl.exec_cmd("fcitx5")
	hl.exec_cmd("wl-paste --type image --watch cliphist store")
	hl.exec_cmd("wl-paste --type text --watch cliphist store")
	hl.exec_cmd("/usr/libexec/kf6/polkit-kde-authentication-agent-1")
	hl.exec_cmd("systemctl --user start hyprland-session.service")
	hl.exec_cmd("systemctl --user start xdg-desktop-portal-hyprland")
end)

--------------------------------
---- WINDOWS AND WORKSPACES ----
--------------------------------

-- See https://wiki.hypr.land/Configuring/Basics/Window-Rules/
-- and https://wiki.hypr.land/Configuring/Basics/Workspace-Rules/

-- Example window rules that are useful

local suppressMaximizeRule = hl.window_rule({
	-- Ignore maximize requests from all apps. You'll probably like this.
	name = "suppress-maximize-events",
	match = { class = ".*" },

	suppress_event = "maximize",
})
suppressMaximizeRule:set_enabled(false)

hl.window_rule({
	-- Fix some dragging issues with XWayland
	name = "fix-xwayland-drags",
	match = {
		class = "^$",
		title = "^$",
		xwayland = true,
		float = true,
		fullscreen = false,
		pin = false,
	},

	no_focus = true,
})

-- Layer rules also return a handle.
-- local overlayLayerRule = hl.layer_rule({
--     name  = "no-anim-overlay",
--     match = { namespace = "^my-overlay$" },
--     no_anim = true,
-- })
-- overlayLayerRule:set_enabled(false)

-- Hyprland-run windowrule
hl.window_rule({
	name = "move-hyprland-run",
	match = { class = "hyprland-run" },

	move = "20 monitor_h-120",
	float = true,
})

hl.window_rule({
	name = "float app",
	match = {
		class = "(QQ|com.gabm.satty)",
		title = "(.*聊天记录$|图片查看器|satty)",
	},
	float = true,
	size = { "monitor_w * 0.5", "monitor_h * 0.5" },
})

hl.window_rule({
	name = "transparent terminal",
	match = {
		class = "com.mitchellh.ghostty",
	},
	opacity = "0.9 0.8",
})

-- Bind apps to specific workspaces
-- Browsers → workspace 1 (web)
hl.window_rule({
	name = "browser to web",
	match = { class = "(chromium|brave|zen)" },
	workspace = "1",
})

-- Code/terminal/emacs → workspace 2 (code)
hl.window_rule({
	name = "dev to code",
	match = {
		class = "(code-oss|Code|Cursor|jetbrains-idea|jetbrains-webstorm|com.mitchellh.ghostty|kitty|alacritty|foot|emacs|Emacs)",
	},
	workspace = "2",
})

-- Chat → workspace 3 (main)
hl.window_rule({
	name = "chat to main",
	match = { class = "QQ" },
	workspace = "3",
})

-----------------------
---- LOOK AND FEEL ----
-----------------------

-- Refer to https://wiki.hypr.land/Configuring/Basics/Variables/
hl.config({
	general = {
		gaps_in = 2,
		gaps_out = 2,

		border_size = 1,

		col = {
			-- Tokyo Night border colors (blue #7aa2f7, purple #bb9af7)
			active_border = { colors = { "rgba(7aa2f7ee)", "rgba(bb9af7ee)" }, angle = 45 },
			inactive_border = "rgba(414868aa)",
		},

		-- Set to true to enable resizing windows by clicking and dragging on borders and gaps
		resize_on_border = true,

		-- Please see https://wiki.hypr.land/Configuring/Advanced-and-Cool/Tearing/ before you turn this on
		allow_tearing = false,

		layout = "dwindle",
	},

	decoration = {
		rounding = 0,
		rounding_power = 0,

		-- Change transparency of focused and unfocused windows
		active_opacity = 1.0,
		inactive_opacity = 1.0,

		shadow = {
			enabled = true,
			range = 4,
			render_power = 3,
			color = 0xee1a1a1a,
		},

		blur = {
			enabled = true,
			size = 5,
			passes = 2,
			vibrancy = 0.1696,
		},
	},

	animations = {
		enabled = true,
	},
})

-- Default curves and animations, see https://wiki.hypr.land/Configuring/Advanced-and-Cool/Animations/
hl.curve("easeOutQuint", { type = "bezier", points = { { 0.23, 1 }, { 0.32, 1 } } })
hl.curve("easeInOutCubic", { type = "bezier", points = { { 0.65, 0.05 }, { 0.36, 1 } } })
hl.curve("linear", { type = "bezier", points = { { 0, 0 }, { 1, 1 } } })
hl.curve("almostLinear", { type = "bezier", points = { { 0.5, 0.5 }, { 0.75, 1 } } })
hl.curve("quick", { type = "bezier", points = { { 0.15, 0 }, { 0.1, 1 } } })

-- Default springs
hl.curve("easy", { type = "spring", mass = 1, stiffness = 71.2633, dampening = 15.8273644 })
hl.curve("smooth", { type = "spring", mass = 1, stiffness = 120, dampening = 20 })

hl.animation({ leaf = "global", enabled = true, speed = 1, bezier = "default" })
hl.animation({ leaf = "border", enabled = true, speed = 2, bezier = "easeOutQuint" })
hl.animation({ leaf = "windows", enabled = true, speed = 5, spring = "smooth" })
hl.animation({ leaf = "windowsIn", enabled = true, speed = 5, spring = "smooth", style = "popin 95%" })
hl.animation({ leaf = "windowsOut", enabled = true, speed = 5, spring = "smooth", style = "popin 95%" })
hl.animation({ leaf = "fadeIn", enabled = true, speed = 4, bezier = "almostLinear" })
hl.animation({ leaf = "fadeOut", enabled = true, speed = 4, bezier = "almostLinear" })
hl.animation({ leaf = "fade", enabled = true, speed = 3.5, bezier = "quick" })
hl.animation({ leaf = "layers", enabled = true, speed = 5, spring = "smooth" })
hl.animation({ leaf = "layersIn", enabled = true, speed = 4, spring = "smooth", style = "fade" })
hl.animation({ leaf = "layersOut", enabled = true, speed = 4, spring = "smooth", style = "fade" })
hl.animation({ leaf = "fadeLayersIn", enabled = true, speed = 3, bezier = "almostLinear" })
hl.animation({ leaf = "fadeLayersOut", enabled = true, speed = 3, bezier = "almostLinear" })
hl.animation({ leaf = "workspaces", enabled = true, speed = 4, spring = "smooth", style = "slidevert" })
hl.animation({ leaf = "workspacesIn", enabled = true, speed = 4, spring = "smooth", style = "slidevert" })
hl.animation({ leaf = "workspacesOut", enabled = true, speed = 4, spring = "smooth", style = "slidevert" })
hl.animation({ leaf = "zoomFactor", enabled = true, speed = 3, bezier = "quick" })

-- Per-workspace layouts and names
hl.workspace_rule({ workspace = "1", layout = "scrolling", default_name = "web", layout_opts = { column_width = 0.4 } })
hl.workspace_rule({
	workspace = "2",
	layout = "dwindle",
	default_name = "code",
	layout_opts = { smart_split = true, split_width_multiplier = 1.5 },
})
hl.workspace_rule({ workspace = "3", layout = "master", default_name = "chat", layout_opts = { mfact = 0.6 } })

-- Ref https://wiki.hypr.land/Configuring/Basics/Workspace-Rules/
-- "Smart gaps" / "No gaps when only"
-- uncomment all if you wish to use that.
-- hl.workspace_rule({ workspace = "w[tv1]", gaps_out = 0, gaps_in = 0 })
-- hl.workspace_rule({ workspace = "f[1]",   gaps_out = 0, gaps_in = 0 })
-- hl.window_rule({
--     name  = "no-gaps-wtv1",
--     match = { float = false, workspace = "w[tv1]" },
--     border_size = 0,
--     rounding    = 0,
-- })
-- hl.window_rule({
--     name  = "no-gaps-f1",
--     match = { float = false, workspace = "f[1]" },
--     border_size = 0,
--     rounding    = 0,
-- })

-- See https://wiki.hypr.land/Configuring/Layouts/Dwindle-Layout/ for more
hl.config({
	dwindle = {
		preserve_split = true, -- You probably want this
	},
})

-- See https://wiki.hypr.land/Configuring/Layouts/Master-Layout/ for more
hl.config({
	master = {
		new_status = "master",
	},
})

-- See https://wiki.hypr.land/Configuring/Layouts/Scrolling-Layout/ for more
hl.config({
	scrolling = {
		fullscreen_on_one_column = true,
	},
})

----------------
----  MISC  ----
----------------

hl.config({
	misc = {
		force_default_wallpaper = -1, -- Set to 0 or 1 to disable the anime mascot wallpapers
		disable_hyprland_logo = false, -- If true disables the random hyprland logo / anime girl background. :(
	},
})

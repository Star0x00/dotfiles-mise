-- plugins/init.lua — loads plugin modules with lazy strategies
--
-- Uses MiniMisc.safely() for phased, fail-safe loading:
--   0. themes       — now      (colorscheme must be set before UI renders)
--   1. lsp          — now      (vim.lsp.enable() is lightweight; must run
--                                before first file opens so servers attach)
--   2. core + tools — later    (next tick, non-blocking)
--   3. completion   — InsertEnter (only when typing)
--
-- Each safely() call is wrapped in pcall, so if one module errors,
-- the rest still load and the error is shown as a vim.notify warning.

vim.pack.add({
	"https://github.com/catppuccin/nvim",
	"https://github.com/nvim-mini/mini.nvim",
	"https://github.com/rafamadriz/friendly-snippets",
	{ src = "https://github.com/Saghen/blink.cmp", version = "v1.10.2" },
	"https://github.com/NeogitOrg/neogit",
	"https://github.com/esmuellert/codediff.nvim",
	{ src = "https://github.com/nvim-treesitter/nvim-treesitter", version = "main" },
})

-- Phase 0: Themes — must be loaded before UI renders
require("plugins.themes")

-- Phase 1: LSP — synchronous (vim.lsp.enable() is just registering servers,
-- lightweight; must run before first file opens so servers attach to it)
require("plugins.lsp")

-- Setup mini.misc for safely() and other utilities
require("mini.misc").setup()

local safely = MiniMisc.safely

-- Phase 2: Core editor features + tools — deferred to next tick
-- These are needed eventually but don't block initial UI rendering.
-- Keymaps reference MiniPick/MiniExtra via closures, so they'll work
-- fine as long as the user hasn't pressed the key before this runs.
safely("later", function()
	require("plugins.core")
end)
safely("later", function()
	require("plugins.tools")
end)

-- Phase 3: Completion — on first file open
-- blink.cmp needs to be ready before BufReadPost to avoid delay on first keystroke.
safely("event:BufReadPost", function()
	require("plugins.format")
end)
safely("event:BufReadPost", function()
	require("plugins.completion")
end)

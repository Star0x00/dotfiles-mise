vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.cursorline = true
vim.opt.expandtab = true
vim.opt.tabstop = 4
vim.opt.shiftwidth = 2
vim.opt.scrolloff = 1000
vim.opt.autoread = true
vim.o.showtabline = 2
vim.opt.splitbelow = true
vim.opt.splitright = true
vim.schedule(function()
  vim.opt.clipboard = 'unnamedplus'
end)
vim.opt.undofile = true
vim.opt.fillchars:append { eob = ' ' }
-- Render invisibles; `leadmultispace` draws one glyph per indent level.
vim.opt.sessionoptions = 'curdir,folds,globals,help,tabpages,terminal,winsize'
vim.o.cmdheight = 1
vim.o.winborder = 'none'
-- Treesitter highlighting for filetypes with installed parsers.
-- Parser list is maintained in lua/plugins/core.lua; pcall so missing
-- parsers/queries (e.g. awk has no highlight queries) don't error.
-- stylua: ignore start
vim.api.nvim_create_autocmd("FileType", {
  pattern = {
    "c", "cpp", "lua", "python", "go", "rust", "bash", "fish", "json", "yaml", "toml",
    "html", "css", "markdown", "vim", "diff", "gitcommit", "gitignore", "gitattributes",
    "cmake", "ninja", "asm", "glsl", "zig", "nix", "nu", "kdl", "awk", "latex",
    "typst", "qmljs", "luadoc", "astro", "llvm", "vimdoc", 'superhtml', 'ziggy', 'ziggy_schema'
  },
  callback = function() pcall(vim.treesitter.start) end,
})
-- stylua: ignore end

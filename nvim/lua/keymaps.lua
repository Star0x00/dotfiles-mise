vim.g.mapleader = ' '
vim.g.maplocalleader = '\\'

-- stylua: ignore start
vim.keymap.set("i", "<C-h>", "<Left>", { noremap = true, silent = true, desc = "Move Left" })
vim.keymap.set("i", "<C-j>", "<Down>", { noremap = true, silent = true, desc = "Move Down" })
vim.keymap.set("i", "<C-k>", "<Up>", { noremap = true, silent = true, desc = "Move Up" })
vim.keymap.set("i", "<C-l>", "<Right>", { noremap = true, silent = true, desc = "Move Right" })
vim.keymap.set("n", "<C-z>", "u", { noremap = true, silent = true, desc = "Undo" })
vim.keymap.set("n", "<C-h>", "<C-w>h", { desc = "Window left" })
vim.keymap.set("n", "<C-j>", "<C-w>j", { desc = "Window down" })
vim.keymap.set("n", "<C-k>", "<C-w>k", { desc = "Window up" })
vim.keymap.set("n", "<C-l>", "<C-w>l", { desc = "Window right" })

vim.keymap.set("n", "]t", "<Cmd>tabnext<CR>", { desc = "Next tab" })
vim.keymap.set("n", "[t", "<Cmd>tabprev<CR>", { desc = "Prev tab" })
vim.keymap.set("n", "<Leader>bd", "<Cmd>bdelete<CR>", { desc = "Buffer close" })
vim.keymap.set("n", "<Leader>td", "<Cmd>tabclose<CR>", { desc = "Tab close" })

local snack_pick = function(name)
  return function()
    Snacks.picker[name]()
  end
end

vim.keymap.set("n", "<Leader>ff", snack_pick "files", { desc = "Find files" })
vim.keymap.set("n", "<Leader>fgl", snack_pick "grep", { desc = "Grep" })
vim.keymap.set("n", "<Leader>fbb", snack_pick "buffers", { desc = "Buffers" })
vim.keymap.set("n", "<Leader>fbl", snack_pick "lines", { desc = "Buffer lines" })
vim.keymap.set("n", "<Leader>fhh", snack_pick "help", { desc = "Help" })
vim.keymap.set("n", "<Leader>fc", snack_pick "commands", { desc = "Commands" })
vim.keymap.set("n", "<Leader>fd", snack_pick "diagnostics", { desc = "Diagnostics" })
vim.keymap.set("n", "<Leader>fht", function()
  Snacks.picker.grep { search = "FIXME|HACK|TODO|NOTE", regex = true }
end, { desc = "Hipatterns" })
vim.keymap.set("n", "<Leader>fhi", snack_pick "search_history", { desc = "History" })
vim.keymap.set("n", "<Leader>fk", snack_pick "keymaps", { desc = "Keymaps" })
vim.keymap.set("n", "<Leader>fq", snack_pick "qflist", { desc = "Quickfix" })
vim.keymap.set("n", "<Leader>fm", snack_pick "man", { desc = "Manpages" })

vim.keymap.set("n", "<Leader>gb", snack_pick "git_branches", { desc = "Git branches" })
vim.keymap.set("n", "<Leader>gc", snack_pick "git_log", { desc = "Git commits" })
vim.keymap.set("n", "<Leader>gf", snack_pick "git_files", { desc = "Git files" })
vim.keymap.set("n", "<Leader>gh", snack_pick "git_diff", { desc = "Git diff" })

vim.keymap.set("n", "<Leader>gd", snack_pick "lsp_definitions", { desc = "LSP definition" })
vim.keymap.set("n", "<Leader>gD", snack_pick "lsp_declarations", { desc = "LSP declaration" })
vim.keymap.set("n", "<Leader>gr", snack_pick "lsp_references", { desc = "LSP references" })
vim.keymap.set("n", "<Leader>gI", snack_pick "lsp_implementations", { desc = "LSP implementation" })
vim.keymap.set("n", "<Leader>gt", snack_pick "lsp_type_definitions", { desc = "LSP type definition" })
vim.keymap.set("n", "<Leader>gs", snack_pick "lsp_symbols", { desc = "LSP document symbols" })
vim.keymap.set("n", "<Leader>gW", snack_pick "lsp_workspace_symbols", { desc = "LSP workspace symbols" })

-- jj (jj.nvim): log/status/diff/describe and friends
vim.keymap.set("n", "<Leader>vl", "<Cmd>J log<CR>", { desc = "jj log" })
vim.keymap.set("n", "<Leader>vs", "<Cmd>J st<CR>", { desc = "jj status" })
vim.keymap.set("n", "<Leader>vd", "<Cmd>Jdiff<CR>", { desc = "jj diff" })
vim.keymap.set("n", "<Leader>vD", "<Cmd>J desc<CR>", { desc = "jj describe" })
vim.keymap.set("n", "<Leader>vc", "<Cmd>J commit<CR>", { desc = "jj commit" })
vim.keymap.set("n", "<Leader>vn", "<Cmd>J new<CR>", { desc = "jj new" })
vim.keymap.set("n", "<Leader>ve", "<Cmd>J edit<CR>", { desc = "jj edit" })
vim.keymap.set("n", "<Leader>vu", "<Cmd>J undo<CR>", { desc = "jj undo" })
vim.keymap.set("n", "<Leader>vS", "<Cmd>J split<CR>", { desc = "jj split" })
vim.keymap.set("n", "<Leader>vq", "<Cmd>J squash<CR>", { desc = "jj squash" })
vim.keymap.set("n", "<Leader>vr", "<Cmd>J rebase<CR>", { desc = "jj rebase" })

vim.keymap.set("n", "<Leader>jj", function() MiniJump2d.start(MiniJump2d.builtin_opts.single_character) end, { desc = "Jump2d char" })
vim.keymap.set("n", "<Leader>jw", function() MiniJump2d.start(MiniJump2d.builtin_opts.word_start) end, { desc = "Jump2d word" })
vim.keymap.set("n", "<Leader>jl", function() MiniJump2d.start(MiniJump2d.builtin_opts.line_start) end, { desc = "Jump2d line" })
vim.keymap.set("n", "<Leader>js", function() MiniJump2d.start(MiniJump2d.builtin_opts.query) end, { desc = "Jump2d search" })

vim.keymap.set("n", "<Leader>fe", function() require("mini.files").open() end, { desc = "Explorer (mini.files)" })
vim.keymap.set("n", "<Leader>fH", function() require("mini.files").open(vim.fn.expand "~") end, { desc = "Explorer (mini.files) home" })

vim.keymap.set({ "n", "x" }, "<Leader>ca", vim.lsp.buf.code_action, { desc = "Code action" })
-- You may want these if you use the opinionated `<C-a>` and `<C-x>` keymaps above — otherwise consider `<leader>o…` (and remove terminal mode from the `toggle` keymap)
vim.keymap.set("n", "+", "<C-a>", { desc = "Increment under cursor", noremap = true })
vim.keymap.set("n", "-", "<C-x>", { desc = "Decrement under cursor", noremap = true })

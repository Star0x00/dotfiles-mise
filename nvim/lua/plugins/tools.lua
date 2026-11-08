-- snacks.nvim — pickers, indent guides, notifier, input/terminal.
-- `explorer` is intentionally NOT enabled: the file explorer stays mini.files.
require('snacks').setup {
  picker = {
    enabled = true,
    -- recent-file bonus on top of the fuzzy score
    frecency = true,
  },
  indent = {
    enabled = true,
    indent = {
      char = '│',
      -- only draw guides for the block the cursor is in; nothing when the
      -- cursor sits at an indentation level with no enclosing scope
      only_scope = true,
      -- cycle one colour per indent level (DiagnosticInfo/Hint/Warn/Error...)
      hl = {
        'SnacksIndent1',
        'SnacksIndent2',
        'SnacksIndent3',
        'SnacksIndent4',
        'SnacksIndent5',
        'SnacksIndent6',
        'SnacksIndent7',
        'SnacksIndent8',
      },
    },
    scope = { enabled = true, char = '│', underline = true },
    -- `chunk = { enabled = true }` renders whole blocks with ┌ └ corners
    chunk = { enabled = false },
    animate = { enabled = true, style = 'out', duration = { step = 15, total = 250 } },
  },
  notifier = {
    enabled = true,
    style = 'compact',
    top_down = true,
    timeout = 3000,
    width = { min = 40, max = 0.4 },
    level = vim.log.levels.INFO,
  },
  input = { enabled = true },
  terminal = { enabled = true, win = { style = 'terminal', border = 'rounded', backdrop = false } },
  -- no "big file" notification spam, just the size guard
  bigfile = { enabled = true, size = 1.5 * 1024 * 1024, notify = false },
  quickfile = { enabled = true, exclude = { 'latex', 'typst' } },
  bufdelete = { enabled = true },
}

-- mini.files: the file explorer
require('mini.files').setup()
require('mini.jump').setup()
require('mini.jump2d').setup()

-- mini.diff
require('mini.diff').setup {
  view = {
    style = 'sign',
    signs = { add = '│', change = '│', delete = '│' },
  },
}
vim.keymap.set('n', '<Leader>go', function()
  MiniDiff.toggle_overlay()
end, { desc = 'Diff overlay' })

-- codediff.nvim — also the backend for jj.nvim's diff module
require('codediff').setup()
vim.keymap.set('n', '<Leader>gv', '<Cmd>CodeDiff<CR>', { desc = 'CodeDiff' })

-- jj.nvim — jj subcommands from Neovim (`:J log`, `:J desc`, `:J st`, ...).
-- Picker backend: snacks. Log/status buffer keymaps keep their upstream
-- defaults; override them under `cmd.keymaps.log` / `cmd.keymaps.status`
-- if needed (nil disables one).
require('jj').setup {
  picker = { snacks = {} },
  diff = { backend = 'codediff' },
  cmd = {
    -- close the log buffer after <CR> checks out a revision
    close_on_edit = true,
    describe = {
      editor = { type = 'buffer', keymaps = { close = { '<C-c>', 'q' } } },
    },
  },
}

-- mini.clue
local miniclue = require 'mini.clue'
miniclue.setup {
  triggers = {
    -- Leader triggers
    { mode = { 'n', 'x' }, keys = '<Leader>' },

    -- `[` and `]` keys
    { mode = 'n', keys = '[' },
    { mode = 'n', keys = ']' },

    -- Built-in completion
    { mode = 'i', keys = '<C-x>' },

    -- `g` key
    { mode = { 'n', 'x' }, keys = 'g' },

    -- Marks
    { mode = { 'n', 'x' }, keys = "'" },
    { mode = { 'n', 'x' }, keys = '`' },

    -- Registers
    { mode = { 'n', 'x' }, keys = '"' },
    { mode = { 'i', 'c' }, keys = '<C-r>' },

    -- Window commands
    { mode = 'n', keys = '<C-w>' },

    -- `z` key
    { mode = { 'n', 'x' }, keys = 'z' },

    -- Jump2d
    { mode = 'n', keys = '<Leader>j' },
  },

  clues = {
    -- Enhance this by adding descriptions for <Leader> mapping groups
    miniclue.gen_clues.square_brackets(),
    miniclue.gen_clues.builtin_completion(),
    miniclue.gen_clues.g(),
    miniclue.gen_clues.marks(),
    miniclue.gen_clues.registers(),
    miniclue.gen_clues.windows(),
    miniclue.gen_clues.z(),

    -- <Leader>g group
    { mode = 'n', keys = '<Leader>g', desc = '+goto/git' },
    -- <Leader>v group
    { mode = 'n', keys = '<Leader>v', desc = '+jj' },
  },
}

-- mini.hipatterns
local hipatterns = require 'mini.hipatterns'
hipatterns.setup {
  highlighters = {
    -- Highlight standalone 'FIXME', 'HACK', 'TODO', 'NOTE'
    fixme = { pattern = '%f[%w]()FIXME()%f[%W]', group = 'MiniHipatternsFixme' },
    hack = { pattern = '%f[%w]()HACK()%f[%W]', group = 'MiniHipatternsHack' },
    todo = { pattern = '%f[%w]()TODO()%f[%W]', group = 'MiniHipatternsTodo' },
    note = { pattern = '%f[%w]()NOTE()%f[%W]', group = 'MiniHipatternsNote' },

    -- Highlight hex color strings (`#rrggbb`) using that color
    hex_color = hipatterns.gen_highlighter.hex_color(),
  },
}

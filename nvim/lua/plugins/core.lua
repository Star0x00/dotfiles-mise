-- mini.ai
local gen_ai_spec = require('mini.extra').gen_ai_spec
require('mini.ai').setup {
  custom_textobjects = {
    B = gen_ai_spec.buffer(),
    D = gen_ai_spec.diagnostic(),
    I = gen_ai_spec.indent(),
    L = gen_ai_spec.line(),
    N = gen_ai_spec.number(),
  },
}

-- mini.trailspace
require('mini.trailspace').setup {
  only_in_normal_buffers = true,
}
vim.api.nvim_create_autocmd('BufWritePre', {
  pattern = '*',
  callback = function()
    MiniTrailspace.trim()
  end,
})

require('mini.animate').setup()
require('mini.bracketed').setup()
require('mini.comment').setup()
require('mini.cursorword').setup()
require('mini.icons').setup()
require('mini.indentscope').setup()
require('mini.input').setup()
require('mini.move').setup()
require('mini.operators').setup()
require('mini.pairs').setup()
require('mini.splitjoin').setup()
require('mini.surround').setup()

-- nvim-treesitter (main branch API): manages parsers + queries.
-- NOTE: `main` has no `auto_install`; parsers are listed explicitly instead.
-- Keep this list in sync with the FileType highlight autocmd in options.lua.
require('nvim-treesitter').setup {
  install_dir = vim.fn.stdpath 'data' .. '/site',
}
-- stylua: ignore start
-- Download & build parsers synchronously (README: `install` is async, use
-- `:wait()` to bootstrap before the first file opens). No-op if already
-- installed; skipped if compilation times out or errors. pcall guards so a
-- missing tree-sitter-cli/compiler doesn't block startup.
pcall(function()
  require('nvim-treesitter')
    .install {
      'astro', 'asm', 'awk', 'bash', 'c', 'cmake', 'cpp', 'css', 'diff', 'fish',
      'gitattributes', 'gitcommit', 'gitignore', 'glsl', 'go', 'html', 'json',
      'kdl', 'latex', 'llvm', 'lua', 'luadoc', 'markdown', 'markdown_inline',
      'ninja', 'nix', 'nu', 'python', 'qmljs', 'query', 'rust', 'toml', 'typst',
      'vim', 'vimdoc', 'yaml', 'zig',
    }
    :wait(300000)
end)
-- stylua: ignore end

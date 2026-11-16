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

vim.api.nvim_create_autocmd('User', {
  pattern = 'TSUpdate',
  callback = function()
    require('nvim-treesitter.parsers').supermd = {
      install_info = {
        url = 'https://github.com/kristoff-it/supermd',
        location = 'tree-sitter/supermd',
      },
    }
    require('nvim-treesitter.parsers').supermd_inline = {
      install_info = {
        url = 'https://github.com/kristoff-it/supermd',
        location = 'tree-sitter/supermd-inline',
      },
    }
  end,
})
-- stylua: ignore start
-- Download & build parsers synchronously (README: `install` is async, use
-- `:wait()` to bootstrap before the first file opens). No-op if already
-- installed. pcall guards so a missing tree-sitter-cli/compiler doesn't block
-- startup; the return value is checked because `install` reports failures only
-- by returning false (no error is raised), and downloads can hang on a bad
-- network, hence the shorter wait.
local ts_languages = {
  'astro', 'asm', 'awk', 'bash', 'c', 'cmake', 'cpp', 'css', 'diff', 'fish',
  'gitattributes', 'gitcommit', 'gitignore', 'glsl', 'go', 'html', 'json',
  'kdl', 'latex', 'llvm', 'lua', 'luadoc', 'markdown', 'markdown_inline',
  'ninja', 'nix', 'nu', 'python', 'qmljs', 'query', 'rust', 'toml', 'typst',
  'vim', 'vimdoc', 'yaml', 'zig', 'superhtml', 'ziggy', 'ziggy_schema',
  'supermd', 'supermd_inline',
}
local ts_ok, ts_done = pcall(function()
  return require('nvim-treesitter').install(ts_languages):wait(60000)
end)
-- stylua: ignore end
if not ts_ok or not ts_done then
  vim.notify(
    'nvim-treesitter: 有 parser 未安装（网络/编译失败），用 :TSInstall <lang> 补装；:messages 查看错误',
    vim.log.levels.WARN,
    { title = 'nvim-treesitter' }
  )
end

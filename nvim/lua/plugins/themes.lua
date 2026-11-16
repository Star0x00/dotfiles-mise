--=============================================================================
-- Theme
--=============================================================================
-- Catppuccin Mocha, transparent background.
vim.o.background = 'dark'

require('catppuccin').setup {
  flavour = 'mocha', -- latte, frappe, macchiato, mocha
  transparent_background = true,
  float = {
    transparent = true,
    solid = false,
  },
}
vim.cmd.colorscheme 'catppuccin'

require('mini.tabline').setup()

-- lualine, colored the way catppuccin's lualine integration colors it:
-- a=blue/mantle, b=surface0/blue, c=transparent/text, and x/y/z reuse c/b/a.
-- Section separators are the rounded half-circle glyphs (U+E0B4 / U+E0B2),
-- written as escapes because private-use-area chars get stripped by tooling.
-- lualine has no built-in LSP component.
local function lsp_status()
  local names = {}
  for _, client in ipairs(vim.lsp.get_clients { bufnr = 0 }) do
    names[#names + 1] = client.name
  end
  if #names == 0 then
    return ''
  end
  return 'Lsp ' .. names[1] .. (#names > 1 and (' +' .. (#names - 1)) or '')
end

require('lualine').setup {
  options = {
    theme = 'auto',
    component_separators = ' ',
    section_separators = { left = '\238\130\180', right = '\238\130\178' },
  },
  sections = {
    lualine_a = { 'mode' },
    lualine_b = { 'progress', 'location' },
    lualine_c = {
      {
        'diagnostics',
        symbols = { error = '● ', warn = '● ', info = '● ', hint = '● ' },
      },
    },
    lualine_x = { lsp_status },
    lualine_y = { 'filename' },
    lualine_z = { 'filetype' },
  },
}

---@diagnostic disable: unused-local, redundant-parameter
local gh = function(x)
  return 'https://github.com/' .. x
end
--=============================================================================
-- LSP — lspconfig
--=============================================================================
vim.pack.add {
  gh 'neovim/nvim-lspconfig',
}
vim.lsp.enable 'lua_ls'
vim.lsp.enable 'astro'
vim.lsp.enable 'zls'
vim.lsp.enable 'clangd'
vim.lsp.enable 'gopls'
vim.lsp.enable 'rust_analyzer'
vim.lsp.enable 'dockerls'
vim.lsp.enable 'nushell'
vim.lsp.enable 'tinymist'
vim.lsp.enable 'jsonls'
vim.lsp.enable 'ts_ls'
vim.lsp.enable 'nixd'

--=============================================================================
-- LSP UX
--=============================================================================
vim.api.nvim_create_autocmd('LspAttach', {
  callback = function(args)
    vim.lsp.inlay_hint.enable(true, { bufnr = args.buf })
  end,
})

vim.diagnostic.config {
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = '●',
      [vim.diagnostic.severity.WARN] = '●',
      [vim.diagnostic.severity.INFO] = '●',
      [vim.diagnostic.severity.HINT] = '●',
    },
  },
  underline = false,
  virtual_text = true,
  update_in_insert = false,
  severity_sort = true,
}

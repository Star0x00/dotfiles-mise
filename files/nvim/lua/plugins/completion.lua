-- blink.cmp
require('blink.cmp').setup {
  keymap = {
    preset = 'default',
    ['<Tab>'] = { 'select_next', 'fallback' },
    ['<S-Tab>'] = { 'select_prev', 'fallback' },
    ['<CR>'] = { 'accept', 'fallback' },
    ['<C-u>'] = { 'scroll_documentation_up', 'fallback' },
    ['<C-d>'] = { 'scroll_documentation_down', 'fallback' },
  },

  appearance = {
    nerd_font_variant = 'mono',
  },

  completion = {
    documentation = { auto_show = true },
    menu = {
      border = 'none',
      draw = {
        columns = {
          { 'label', 'label_description', gap = 1 },
          { 'kind' },
          { 'source_name' },
        },
      },
    },
  },

  sources = {
    default = { 'lsp', 'path', 'snippets', 'buffer' },
  },
}

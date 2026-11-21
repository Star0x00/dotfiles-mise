# AGENTS.md - Neovim Configuration

This is a Neovim configuration repository using Lua. It uses `vim.pack` for plugin management, `mini.nvim` suite for core functionality, and `conform.nvim`/`nvim-lint` for formatting/linting.

## Commands

### Linting
```bash
selene .
```

### Formatting
```bash
stylua lua/ init.lua
```

### Format on Save
The config uses `conform.nvim` with `format_on_save` enabled (timeout 2000ms, lsp_fallback true). Format on save runs automatically for Lua files via `BufWritePost` autocmd.

### LSP / Type Checking
```bash
# Emmylua (Lua LSP)
emmylua_ls
```

### Running Neovim with Config
```bash
nvim
XDG_CONFIG_HOME=/var/home/cyrene/.config nvim
```

## Code Style

### General
- **Language**: Lua (LuaJIT syntax, no semicolons required)
- **Encoding**: UTF-8, Unix line endings
- **Indentation**: 2 spaces
- **Column width**: 80 (stylua.toml) / 160 (.stylua.toml) - prefer 80 for new code
- **Quote style**: AutoPreferDouble (stylua.toml), AutoPreferSingle (.stylua.toml) - prefer double quotes
- **Call parentheses**: Always (stylua.toml) - e.g., `require("mini.ai").setup()`

### Structure
```
init.lua          -- Entry point, requires all modules
lua/plugins.lua   -- Plugin management and configuration
lua/options.lua   -- Neovim options (vim.opt, vim.o)
lua/keymaps.lua   -- Keybindings (vim.keymap.set)
```

### Modules
- Use `require("module_name")` to load modules
- Do NOT use `require("lazy")`, `require("packer")`, etc. (uses `vim.pack.add`)
- Use `pcall(vim.cmd.colorscheme, "name")` for optional plugins that may fail

### Comments
- Section headers use pattern:
  ```lua
  --=============================================================================
  -- Section Title
  --=============================================================================
  ```
- Use `--` for single-line comments
- Inline comments are allowed but avoid excessive inline commentary
- Use `-- stylua: ignore start` and `-- stylua: ignore end` to exclude regions from formatting

### Naming Conventions
- Variables: `snake_case`
- Functions: `snake_case`
- Module names: `snake_case.lua`
- Tables/Options: `snake_case`
- Keys in vim options: use camelCase where vim uses it (e.g., `vim.opt.expandtab` not `vim.opt.expand_tab`)

### Neovim API Patterns

#### Options
```lua
vim.opt.option = value      -- Boolean/table options
vim.o.option = value        -- Global options
vim.g.option = value        -- Global variables
```

#### Keymaps
```lua
vim.keymap.set(mode, lhs, rhs, { noremap = true, silent = true, desc = "Description" })
-- modes: "n", "x", "i", "c", "t", { "n", "x" }
-- Always include desc for user-facing keymaps
```

#### Autocmds
```lua
vim.api.nvim_create_autocmd("event", {
  pattern = { "*.lua", "*.vim" },
  callback = function(args) end,
  -- or
  command = "set some option",
})
```

#### Plugins (vim.pack.add)
```lua
vim.pack.add({ "github/repo" })                      -- Simple plugin
vim.pack.add({ src = "github/repo", version = "v1.0" }) -- With version
vim.pack.add({ "repo1", "repo2", "repo3" })            -- Multiple
```

### Error Handling
- Use `pcall()` for operations that may fail (colorschemes, optional deps)
- Use `vim.schedule()` for clipboard and other operations that must be async
```lua
vim.schedule(function() vim.opt.clipboard = "unnamedplus" end)
```

### Treesitter
- Parsers are managed by `nvim-treesitter` (**main** branch API): `setup()` + explicit `install { ... }` list in `lua/plugins/core.lua`
- `main` has NO `auto_install` — add new parsers to the `install` list (and run `:TSInstall <lang>` ad-hoc)
- Keep the parser list in sync with the FileType autocmd in `lua/options.lua`
- Use `pcall(vim.treesitter.start)` in a FileType autocmd to enable Treesitter highlighting
- Use `vim.treesitter.stop()` to disable
- After updating the plugin run `:TSUpdate` to sync parsers/queries to the locked revisions
- Requires `tree-sitter-cli` (>= 0.26.1, not npm), `curl`, `tar`, and a C compiler in PATH

### LSP
- Enable LSP servers with `vim.lsp.enable("server_name")`
- Use `LspAttach` autocmd for per-buffer LSP configuration
```lua
vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    vim.lsp.inlay_hint.enable(true, { bufnr = args.buf })
  end,
})
```

### Diagnostics
```lua
vim.diagnostic.config({
  signs = { text = { [vim.diagnostic.severity.ERROR] = "●" } },
  underline = false,
  virtual_text = false,
  update_in_insert = false,
  severity_sort = true,
})
```

## Tooling

### mise.toml Tools
- `lua` - Lua interpreter
- `stylua` - Lua formatter
- `selene` - Lua linter
- `emmylua_ls` - Lua LSP

### Editor Plugins (in nvim)
- **conform.nvim**: Format on save, `formatters_by_ft = { lua = { "stylua" } }`
- **nvim-lint**: Lint on save, `linters_by_ft = { lua = { "selene" } }`

## File Patterns

- `**/*.lua` - Lua source files
- `init.lua` - Entry point
- `lua/*.lua` - Configuration modules
- `.stylua.toml` - Stylua config for root
- `stylua.toml` - Stylua config for some subdirectories
- `selene.toml` - Selene linter config
- `.emmyrc.json` - Emmylua LSP config

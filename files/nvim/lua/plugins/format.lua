-- plugins/format.lua — treefmt 优先，回退到内置命令表
-- 若 buffer 所在目录向上能找到 treefmt 配置，则把内容经 stdin 交给
-- `treefmt --stdin <abs-path>`（项目级配置，单一事实来源）；
-- 否则按 filetype 调用下面这张内置表。

local fallback = {
  lua = { 'stylua', '--search-parent-directories', '-' },
  nix = { 'nixfmt' },
  go = { 'gofmt' },
  rust = { 'rustfmt' },
  zig = { 'zig', 'fmt', '--stdin' },
  c = { 'clang-format' },
  cpp = { 'clang-format' },
  json = { 'jq', '.' },
  html = { 'tidy', '-indent', '-quiet', '--tidy-mark', 'no' },
  yaml = { 'yamlfmt' },
  python = { 'ruff', 'format', '-' },
  markdown = { 'prettier', '--parser', 'markdown' },
  typescript = { 'prettier', '--parser', 'typescript' },
  javascript = { 'prettier', '--parser', 'babel' },
  css = { 'prettier', '--parser', 'css' },
}

-- treefmt 的配置文件查找顺序，向上逐级搜索
local treefmt_names = { 'treefmt.toml', '.treefmt.toml', '.config/treefmt.toml' }

local function treefmt_root(dir)
  while dir ~= '' and dir ~= '/' do
    for _, name in ipairs(treefmt_names) do
      if vim.uv.fs_stat(dir .. '/' .. name) then
        return dir
      end
    end
    local parent = vim.fn.fnamemodify(dir, ':h')
    if parent == dir then
      break
    end
    dir = parent
  end
end

local function apply(out)
  local lines = vim.split(out, '\n', { plain = true })
  if lines[#lines] == '' then
    table.remove(lines)
  end
  vim.api.nvim_buf_set_lines(0, 0, -1, false, lines)
end

local function run(cmd, input, cwd)
  local opts = { stdin = input }
  if cwd then
    opts.cwd = cwd
  end
  return vim.system(cmd, opts):wait()
end

local function format()
  if vim.bo.buftype ~= '' then
    return
  end

  local view = vim.fn.winsaveview()
  local input = table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\n')
  local path = vim.api.nvim_buf_get_name(0)

  -- 1) 有 treefmt 配置就用 treefmt
  if path ~= '' and vim.fn.executable 'treefmt' == 1 then
    local abs = vim.fn.fnamemodify(path, ':p')
    local root = treefmt_root(vim.fn.fnamemodify(abs, ':h'))
    if root then
      local result = run({ 'treefmt', '--stdin', abs }, input, root)
      if result.code == 0 and result.stdout ~= '' then
        apply(result.stdout)
      end
      vim.fn.winrestview(view)
      return
    end
  end

  -- 2) 回退到内置命令表
  local spec = fallback[vim.bo.filetype]
  if spec and vim.fn.executable(spec[1]) == 1 then
    local result = run({ spec[1], unpack(spec, 2) }, input)
    if result.code == 0 then
      apply(result.stdout)
    end
  end

  vim.fn.winrestview(view)
end

vim.api.nvim_create_autocmd('BufWritePre', {
  pattern = '*',
  callback = format,
})

vim.keymap.set({ 'n', 'x' }, '<Leader>F', format, { desc = 'Format buffer' })

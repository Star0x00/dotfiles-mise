# ~/.zshrc — zsh (mise-managed via dotfiles repo)
# Env block mirrors nushell/env.nu (keep in sync); compositor-agnostic GUI vars
# come from the niri session (systemd/user/niri.service.d/).

# ---- Environment ----
typeset -U path
path=(
  "$HOME/.bin"
  "$HOME/.local/share/mise/shims"
  "$HOME/.local/share/npm/bin"
  "$HOME/.local/bin"
  $path
  /usr/local/bin /usr/bin /bin
)

export EDITOR="flow"
export XDG_CACHE_HOME="$HOME/.cache"
export XMODIFIERS="@im=fcitx"
export INPUT_METHOD="fcitx"
export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"

# API keys from pass, same set as nushell/env.nu
if command -v pass >/dev/null 2>&1; then
  export DEEPSEEK_API_KEY="$(pass show api/deepseek 2>/dev/null | head -n 1)"
  export EXA_API_KEY="$(pass show api/exa 2>/dev/null | head -n 1)"
fi

# ---- Shell behaviour ----
setopt autocd extended_glob no_beep
HISTFILE="$HOME/.zsh_history"
HISTSIZE=10000
SAVEHIST=100000
setopt hist_ignore_dups hist_ignore_space inc_append_history extended_history

# ---- fzf-tab completion styling (from fzf-tab README) ----
zstyle ':completion:*:git-checkout:*' sort false
zstyle ':completion:*:descriptions' format '[%d]'
zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}
zstyle ':completion:*' menu no
# previews in the Tab menu: directories -> eza, files -> bat
zstyle ':fzf-tab:complete:*:*' fzf-preview 'if [[ -d $realpath ]]; then eza -1 --icons --color=always -- $realpath; else bat --color=always --style=numbers --line-range=:100 -- $realpath 2>/dev/null; fi'
zstyle ':fzf-tab:*' fzf-flags --preview-window=right:60%
zstyle ':fzf-tab:*' use-fzf-default-opts yes
zstyle ':fzf-tab:*' switch-group '<' '>'

# ---- mise (puts its tools on PATH, so everything below can rely on them) ----
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate zsh)"
fi

# ---- fzf: Catppuccin Mocha theme + key bindings ----
# Palette matches kitty/catppuccin_mocha.conf; fzf-tab inherits it through the
# `use-fzf-default-opts` zstyle above. No --height here: it breaks fzf-tab's
# zle window, so the widget-specific options below set their own.
export FZF_DEFAULT_OPTS='--layout=reverse --info=inline-right --pointer=▶ --marker=✓ --color=fg:#cdd6f4,bg:#1e1e2e,hl:#f38ba8,fg+:#cdd6f4,bg+:#313244,hl+:#f38ba8,info:#cba6f7,prompt:#cba6f7,pointer:#f5e0dc,marker:#b4befe,spinner:#f5e0dc,header:#f38ba8,border:#313244,label:#cdd6f4,selected-bg:#45475a'

# Ctrl-T: pick a file, preview it with bat
# Ctrl-R: search history, newest first
export FZF_CTRL_T_OPTS="--height=60% --border=rounded --preview 'bat --color=always --style=numbers --line-range=:300 {}' --preview-window=right:60%"
export FZF_CTRL_R_OPTS='--height=60% --border=rounded --scheme=history'

# Key bindings only (Ctrl-R history, Ctrl-T files, Alt-C cd): `fzf --zsh`
# also emits completion.zsh, which binds Tab and would fight fzf-tab.
if command -v fzf >/dev/null 2>&1; then
  eval "$(fzf --zsh | sed '/### completion.zsh ###/,$d')"
fi

# ---- zinit (turbo: plugins load right after the first prompt) ----
ZINIT_HOME="$HOME/.local/share/zinit/zinit.git"
[[ -f $ZINIT_HOME/zinit.zsh ]] || git clone --depth=1 https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
source "$ZINIT_HOME/zinit.zsh"

# compinit is deferred: it runs in the atinit of the first plugin, then
# cdreplay fires the compdefs the plugins registered before that
zinit ice wait lucid atinit'zicompinit; zicdreplay'
zinit light zsh-users/zsh-syntax-highlighting

# restart the autosuggestion engine after the async load
zinit ice wait lucid atload'_zsh_autosuggest_start'
zinit light zsh-users/zsh-autosuggestions

# last, so fzf-tab takes over Tab; compinit has run by now, so mise's
# completions can be registered here
zinit ice wait lucid atload'eval "$(mise completion zsh)"'
zinit light Aloxaf/fzf-tab

# ---- eza replaces ls ----
if command -v eza >/dev/null 2>&1; then
  alias ls='eza --icons --group-directories-first'
  alias ll='eza -lh --icons --group-directories-first --git'
  alias la='eza -lah --icons --group-directories-first --git'
  alias lt='eza --tree --level=2 --icons'
  alias tree='eza --tree --icons --group-directories-first'
fi

# ---- Tools ----
if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init zsh)"
fi

if [[ $TERM != dumb ]] && command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
fi

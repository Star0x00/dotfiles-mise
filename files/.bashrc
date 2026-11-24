# ~/.bashrc — bash (mise-managed via dotfiles repo)
# Single source of environment for bash. GUI sessions get the same
# variables from the niri session (keep both in sync).

# ---- Environment (login + interactive + non-interactive login) ----
# PATH
case ":${PATH}:" in
  *:"$HOME/.local/bin":*) ;;
  *) PATH="$HOME/.local/bin:$PATH" ;;
esac
case ":${PATH}:" in
  *:"$HOME/AppImages/":*) ;;
  *) PATH="$HOME/AppImages:$PATH" ;;
esac
case ":${PATH}:" in
  *:"$HOME/.local/share/npm/bin":*) ;;
  *) PATH="$HOME/.local/share/npm/bin:$PATH" ;;
esac
case ":${PATH}:" in
  *:"$HOME/.bin":*) ;;
  *) PATH="$HOME/.bin:$PATH" ;;
esac
export PATH

# Misc
export EDITOR="flow"
export XDG_CACHE_HOME="$HOME/.cache"

# ssh agent
export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"

# API keys from pass, same set as nushell/env.nu
if command -v pass >/dev/null 2>&1; then
  export DEEPSEEK_API_KEY="$(pass show api/deepseek 2>/dev/null | head -n 1)"
  export EXA_API_KEY="$(pass show api/exa 2>/dev/null | head -n 1)"
  export GITHUB_TOKEN="$(pass show api/github 2>/dev/null | head -n 1)"
fi

# ---- Interactive-only ----
[[ $- == *i* ]] || return

HISTFILESIZE=100000
HISTSIZE=10000

shopt -s histappend
shopt -s extglob
shopt -s globstar
shopt -s checkjobs

# System bashrc / bash-completion (dnf)
if [ -f /etc/bashrc ]; then
  . /etc/bashrc
fi
if [[ ! -v BASH_COMPLETION_VERSINFO ]] && [ -f /usr/share/bash-completion/bash_completion ]; then
  . /usr/share/bash-completion/bash_completion
fi

# starship prompt
if [[ $TERM != "dumb" ]] && command -v starship >/dev/null 2>&1; then
  eval "$(starship init bash --print-full-init)"
fi

# flyline (bash builtin shipped by the nix profile). `enable -f` needs the shared
# object, not the `flyline` command; the builtin itself refuses to load when the
# shell is not interactive.
__flyline_so="$HOME/.nix-profile/lib/libflyline.so"
if [[ -e $__flyline_so ]] && enable -f "$__flyline_so" flyline 2>/dev/null; then
  flyline mouse --mode disabled
fi
unset __flyline_so

# eza replaces ls
alias ls='eza --icons --group-directories-first'
alias ll='eza -lh --icons --group-directories-first --git'
alias la='eza -lah --icons --group-directories-first --git'
alias lt='eza --tree --level=2 --icons'
alias tree='eza --tree --icons --group-directories-first'
alias ssh='ghostty +ssh --'

# zoxide
if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init bash)"
fi

# bat
if command -v bat >/dev/null 2>&1; then
  help() {
    "$@" --help 2>&1 | bat --plain --language=help
}
fi

# fastfetch
if command -v fastfetch >/dev/null 2>&1; then
  fastfetch
fi

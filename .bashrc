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

# ssh agent
export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"

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

# mise (PATH lookup — no hardcoded store paths)
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate bash)"
  eval "$(mise completion bash)"
fi

# starship prompt
if [[ $TERM != "dumb" ]] && command -v starship >/dev/null 2>&1; then
  eval "$(starship init bash --print-full-init)"
fi

# bat
if command -v bat >/dev/null 2>&1; then
  help() {
    "$@" --help 2>&1 | bat --plain --language=help
}
fi

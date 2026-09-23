# ~/.bashrc — interactive bash (mise-managed via dotfiles repo)
# Login shells get environment from ~/.profile (sourced via .bash_profile).

# Commands that should be applied only for interactive shells.
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

# Environment — idempotent; login shells already got it via .bash_profile
[[ -f ~/.profile ]] && . ~/.profile

# User snippets
if [ -d ~/.bashrc.d ]; then
  for rc in ~/.bashrc.d/*; do
    if [ -f "$rc" ]; then
      . "$rc"
    fi
  done
fi
unset rc

# mise (PATH lookup — no hardcoded store paths)
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate bash)"
  eval "$(mise completion bash)"
fi

# direnv
if command -v direnv >/dev/null 2>&1; then
  eval "$(direnv hook bash)"
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

# flyline — load the newest mise-managed lib; no hardcoded version so a
# `mise install` upgrade picks up the latest file automatically
_flyline_lib=$(ls -t "$HOME/.local/share/mise/installs/github-hal-frgrd-flyline"/*/libflyline.so.* 2>/dev/null | head -1)
if [ -n "$_flyline_lib" ] && [ -f "$_flyline_lib" ]; then
  enable flyline 2>/dev/null || enable -f "$_flyline_lib" flyline
fi
unset _flyline_lib

# ~/.bashrc — bash (mise-managed via dotfiles repo)
# Single source of environment for bash. GUI sessions get the same
# variables from ~/.config/environment.d/10-mise.conf (keep both in sync).

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

# Terminfo
export TERMINFO_DIRS="/etc/terminfo:/usr/share/terminfo:/lib/terminfo"

# Cursor
export XCURSOR_THEME="Bibata-Modern-Ice"
export XCURSOR_SIZE="24"
export XCURSOR_PATH="$HOME/.local/share/icons:$HOME/.icons:/usr/share/icons"

# GUI / Wayland
export GDK_BACKEND="wayland,x11,*"
export BROWSER="chrome"
export WLR_RENDERER="vulkan"
export XDG_SESSION_TYPE="wayland"
export SWAY_UNSUPPORTED_GPU="1"
export CLUTTER_BACKEND="wayland"

# Qt
export QT_QPA_PLATFORM="wayland"
export QT_QPA_PLATFORMTHEME="gtk3"
export QT_IM_MODULES="wayland;fcitx"

# SDL
export SDL_VIDEODRIVER="wayland,x11"
export SDL_IM_MODULE="fcitx"

# Mozilla
export MOZ_ENABLE_WAYLAND="1"

# Fcitx5
export XMODIFIERS="@im=fcitx"
export INPUT_METHOD="fcitx"

# Misc
export EDITOR="hx"

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

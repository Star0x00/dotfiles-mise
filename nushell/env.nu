$env.config.buffer_editor = "hx"
$env.config.show_banner = false

$env.LANG = "en_US.UTF-8"

# Shell-relevant env only.
# GUI/session vars (TERMINFO_DIRS, XCURSOR_*, GDK_BACKEND, BROWSER, WLR_RENDERER,
# CLUTTER_BACKEND, QT_*, SDL_*, MOZ_ENABLE_WAYLAND, ...) are injected by
# ~/.config/environment.d/10-mise.conf and inherited from the systemd user session.
load-env {
  PATH: (
    $env.PATH
    | prepend $"($env.HOME)/.bin"
    | prepend $"($env.HOME)/.local/share/npm/bin"
    | prepend $"($env.HOME)/.local/bin"
    | append "/usr/local/bin"
    | append "/usr/bin"
    | append "/bin"
    | append "/home/linuxbrew/.linuxbrew/bin/"
    | append "/var/home/qwerhyy/.zvm/bin"
    | append "/var/home/qwerhyy/.pixi/bin"
    | str join ":"
  )
  EDITOR: "hx"
  HOME: "/var/home/qwerhyy"
  XDG_CACHE_HOME: "/var/home/qwerhyy/.cache"

  XMODIFIERS: "@im=fcitx"
  INPUT_METHOD: "fcitx"

  SSH_AUTH_SOCK: $"($env.XDG_RUNTIME_DIR)/ssh-agent.socket"
}
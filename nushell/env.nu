$env.config.buffer_editor = "flow"
$env.config.show_banner = false

$env.LANG = "en_US.UTF-8"

# Shell-relevant env only.
# Compositor-agnostic GUI vars (TERMINFO_DIRS, XCURSOR_*, BROWSER, EDITOR,
# MOZ_ENABLE_WAYLAND, ...) come from the niri session
# and inherited from the systemd user session. Wayland/compositor-specific vars
# (QT_QPA_PLATFORM, GDK_BACKEND, WLR_RENDERER, ...) are set by the compositor's
# own config, not globally — they break Plasma's KWin startup.
load-env {
  PATH: (
    $env.PATH
    | prepend $"($env.HOME)/.bin"
    | prepend $"($env.HOME)/.local/share/mise/shims"
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
  EDITOR: "flow"
  HOME: "/var/home/qwerhyy"
  XDG_CACHE_HOME: "/var/home/qwerhyy/.cache"

  XMODIFIERS: "@im=fcitx"
  INPUT_METHOD: "fcitx"

  SSH_AUTH_SOCK: $"($env.XDG_RUNTIME_DIR)/ssh-agent.socket"
}

# API keys from pass (first line of each entry) for fx: provider auth + Exa MCP.
if (which pass | is-not-empty) {
  let keys = [
    { var: "DEEPSEEK_API_KEY", entry: "api/deepseek" }
    { var: "EXA_API_KEY", entry: "api/exa" }
  ]
  for k in $keys {
    let value = ((do -i { pass show $k.entry | lines | first }) | default "")
    if ($value | is-not-empty) { load-env {($k.var): $value} }
  }
}

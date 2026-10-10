# config.nu
#

$env.LANG = "en_US.UTF-8"

# Installed by:
# version = "0.111.0"
#
# This file is used to override default Nushell settings, define
# (or import) custom commands, or run any other startup tasks.
# See https://www.nushell.sh/book/configuration.html
#
# Nushell sets "sensible defaults" for most configuration settings, 
# so your `config.nu` only needs to override these defaults if desired.
#
# You can open this file in your default editor using:
#     config nu
#
# You can also pretty-print and page through the documentation for configuration
# options using:
#     config nu --doc | nu-highlight | less -R


def bh [...args: string] {
  if ($args | is-empty) {
    printf "usage: bh <command>"
    return
  }

  let command = ($args | first 1)
  let subcommand = ($args | skip 1)

  run-external $command ...$subcommand "--help" o+e>| bat -pl help
}

mkdir ($nu.data-dir | path join "vendor/autoload")
zoxide init nushell --cmd cd | save -f ($nu.data-dir | path join "vendor/autoload/zoxide.nu")
# mise: 官方 nu 集成,脚本存进 autoload 目录(同 zoxide),每次启动刷新
if (which mise | is-not-empty) {
  ^mise activate nu | save -f ($nu.data-dir | path join "vendor/autoload/mise.nu")
}
# starship prompt
if (which starship | is-not-empty) {
  starship init nu | save -f ($nu.data-dir | path join "vendor/autoload/starship.nu")
}

# fzf: nushell 无内置绑定,用 commandline + keybinding 自接
# Ctrl-R 模糊历史(预览用 nu-highlight 上色)
$env.config.keybindings ++= [
  {
    name: fuzzy_history
    modifier: control
    keycode: char_r
    mode: [emacs, vi_normal, vi_insert]
    event: [{
      send: ExecuteHostCommand
      cmd: "commandline edit --insert (history | get command | uniq | reverse | str join (char -i 0) | fzf --read0 --scheme history --layout reverse --height 40% --query (commandline) --preview 'echo -n {} | nu --stdin -c \"nu-highlight\"' | decode utf-8 | str trim)"
    }]
  }
  # Ctrl-T 模糊选文件(fzf 无输入时走文件系统)
  {
    name: fuzzy_file
    modifier: control
    keycode: char_t
    mode: [emacs, vi_normal, vi_insert]
    event: [{
      send: ExecuteHostCommand
      cmd: "commandline edit --insert (fzf --scheme path --layout reverse --height 40% | decode utf-8 | str trim)"
    }]
  }
]

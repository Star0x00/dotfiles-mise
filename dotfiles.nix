{ ... }:
let
  repo = "{{home}}/dotfiles";
  # Whole entry of the repo, linked verbatim. All content lives under files/ so
  # the repo root only holds the flake.
  link = subpath: { source = "${repo}/files/${subpath}"; };
  kittyThemes = [
    "catppuccin_mocha.conf"
    "gruvbox_material_dark.conf"
    "kanagawa_dragon.conf"
    "rose-pine-dawn.conf"
    "tokyonight_night.conf"
  ];
  typoraThemes = [
    "catppuccin-mocha.css"
    "rose-pine-dawn.css"
  ];
in
{
  file.home = {
    # ---- home root files ----
    ".Xresources" = link ".Xresources";
    ".bash_profile" = link ".bash_profile";
    ".bashrc" = link ".bashrc";
    ".zshrc" = link ".zshrc";
    ".gitconfig" = link "git/.gitconfig";
    ".npmrc" = link ".npmrc";

    # ---- pi agent (symlinks on purpose: edits in ~/.pi write through) ----
    ".pi/agent/AGENTS.md" = link "pi/agent/AGENTS.md";
    ".pi/agent/mcp.json" = link "pi/agent/mcp.json";
    ".pi/agent/settings.json" = link "pi/agent/settings.json";
    # only package.json: node_modules next to it stays mutable (npm install)
    ".pi/agent/npm/package.json" = link "pi/agent/npm/package.json";
    ".pi/agent/themes" = link "pi/agent/themes";
    ".pi/agent/skills" = link "pi/agent/skills";

    # ---- flatpak apps get their own HOME ----
    ".var/app/io.typora.Typora/config/Typora/themes/catppuccin-mocha.css" = link "typora/catppuccin-mocha.css";
    ".var/app/io.typora.Typora/config/Typora/themes/rose-pine-dawn.css" = link "typora/rose-pine-dawn.css";
  };

  file.xdg_config = {
    # ---- whole directories from the repo ----
    "bat" = link "bat";
    "go-musicfox" = link "go-musicfox";
    "helix" = link "helix";
    "hypr" = link "hypr";
    "mpv" = link "mpv";
    "niri" = link "niri";
    "umbriel" = link "umbriel";
    "yt-dlp" = link "yt-dlp";
    # symlink on purpose: lazy.nvim's nvim-pack-lock.json writes through to the repo
    "nvim" = link "nvim";

    # ---- single files ----
    "flow/include.conf" = link "flow/include.conf";
    "fontconfig/fonts.conf" = link "fontconfig/fonts.conf";
    "ghostty/config" = link "ghostty/config";
    "ghostty/gtk.css" = link "ghostty/gtk.css";
    # gram/ has app-generated themes/ next to the config, so link the file only
    "gram/settings.jsonc" = link "gram/settings.jsonc";
    "jj/config.toml" = link "jj/config.toml";
    # kitty wants its main entry to be named kitty.conf, not config; link the
    # files instead of the directory so runtime state in ~/.config/kitty survives
    "kitty/kitty.conf" = link "kitty/kitty.conf";
    "kitty/quick-access-terminal.conf" = link "kitty/quick-access-terminal.conf";
    "mimeapps.list" = link "mimeapps.list";
    "nushell/config.nu" = link "nushell/config.nu";
    "nushell/env.nu" = link "nushell/env.nu";
    "starship.toml" = link "starship.toml";
  }
  // builtins.listToAttrs (
    map (f: {
      name = "kitty/${f}";
      value = link "kitty/${f}";
    }) kittyThemes
  );

  file.xdg_data = {
    # fcitx5/rime: only 全拼 (rime_mint) in the schema list
    "fcitx5/rime/default.custom.yaml" = link "fcitx5/rime/default.custom.yaml";
    "fcitx5/rime/rime_mint.custom.yaml" = link "fcitx5/rime/rime_mint.custom.yaml";
  };
}

{ config, lib, ... }:
let
  # Host fonts, icon/GTK/Qt themes and XDG user dirs: a flatpak app gets its own
  # HOME and sees none of them otherwise.
  globalFilesystems = [
    # fonts & themes
    "/usr/share/fonts:ro"
    "~/.local/share/fonts:ro"
    "~/.config/fontconfig:ro"
    "~/.config/gtk-3.0:ro"
    "~/.config/gtk-4.0:ro"
    "~/.themes:ro"
    "~/.local/share/themes:ro"
    "~/.icons:ro"
    "~/.local/share/icons:ro"
    # qt: no runtime ships the qt6ct plugin, so that env var only takes effect
    # for apps that bundle it.
    "~/.config/qt5ct:ro"
    "~/.config/qt6ct:ro"
    "~/.config/Kvantum:ro"
    "~/.nix-profile/share/fonts:ro"
    # extras
    "~/Games"
    # xdg user dirs
    "xdg-desktop"
    "xdg-documents"
    "xdg-download"
    "xdg-music"
    "xdg-pictures"
    "xdg-videos"
  ];
in
{
  # One file per override, linked into ~/.local/share/flatpak/overrides/.
  # `filesystems` must be a single line (flatpak splits it on ';').
  config.file.xdg_data = {
    "flatpak/overrides/global".text = ''
      [Context]
      filesystems=${lib.concatStringsSep ";" globalFilesystems};

      [Environment]
      QT_QPA_PLATFORMTHEME=qt6ct
    '';
    "flatpak/overrides/io.typora.Typora".text = ''
      [Environment]
      GTK_THEME=Adwaita:dark
    '';
  };
}

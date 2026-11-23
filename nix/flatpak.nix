{ lib, ... }:
let
  # Host fonts, icon/GTK/Qt themes and XDG user dirs: a flatpak app gets its own
  # HOME and sees none of them otherwise.
  globalFilesystems = [
    # fonts & themes. /usr is reserved by flatpak (`F: Not sharing "/usr/share/fonts"`),
    # so the host fonts come in through ~/.local/share/fonts (a symlink to the
    # profile, see below); the per-font symlinks inside the profile point at other
    # store paths, hence /nix/store:ro.
    "~/.local/share/fonts:ro"
    "/nix/store:ro"
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
    # fontconfig only scans $XDG_DATA_DIRS/*/fonts. Inside the sandbox that is
    # /run/host/user-share, where granted ~/.local/share/* dirs are merged, so
    # point the conventional path at the nix profile instead of overwriting
    # XDG_DATA_DIRS (which would silently drop whatever flatpak adds there).
    "fonts".source = "{{home}}/.nix-profile/share/fonts";

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

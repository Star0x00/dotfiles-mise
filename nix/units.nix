{ pkgs, ... }:
let
  unitPath = with pkgs; [
    pass
    gnupg
    openssh
    systemd
    coreutils
    gnused
    git
  ];
in
{
  systemd.services.niri = {
    overrideStrategy = "asDropin";
    environment = {
      PATH = "%h/.nix-profile/bin:%h/.local/bin:%h/.local/share/npm/bin:%h/.bin:/usr/local/bin:/usr/bin:/usr/local/sbin";
      SSH_AUTH_SOCK = "%t/ssh-agent.socket";
      TERMINFO_DIRS = "/etc/terminfo:/usr/share/terminfo:/lib/terminfo";
      XCURSOR_THEME = "Bibata-Modern-Ice";
      XCURSOR_SIZE = "24";
      XCURSOR_PATH = "%h/.local/share/icons:%h/.icons:/usr/share/icons";
      EDITOR = "flow";
    };
  };

  systemd.services.oo7-daemon = {
    overrideStrategy = "asDropin";
    wantedBy = [ "default.target" ];
  };

  systemd.services."app-com.mitchellh.ghostty" = {
    overrideStrategy = "asDropin";
    wantedBy = [ "graphical-session.target" ];
  };

  # ---- SSH keys from pass -------------------------------------------------------
  systemd.services.ssh-add-pass = {
    description = "Load SSH keys from pass into the ssh-agent";
    documentation = [ "man:pass(1)" "man:ssh-add(1)" ];
    requires = [ "ssh-agent.socket" ];
    after = [ "ssh-agent.socket" ];
    wantedBy = [ "default.target" ];
    path = unitPath;
    environment.SSH_AUTH_SOCK = "%t/ssh-agent.socket";
    serviceConfig.Type = "oneshot";
    script = ''
      key=$(pass show ssh/id_ed25519 2>/dev/null) || exit 0
      [ -n "$key" ] || exit 0
      printf '%s\n' "$key" | ssh-add - 2>/dev/null || true
    '';
  };

  # ---- GITHUB_TOKEN into the user manager environment ---------------------------
  systemd.services.github-token = {
    description = "Export GITHUB_TOKEN from pass into the user manager environment";
    documentation = [ "man:pass(1)" ];
    before = [ "graphical-session-pre.target" ];
    wantedBy = [ "graphical-session-pre.target" ];
    path = unitPath;
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
    };
    script = ''
      tok=$(pass show api/github 2>/dev/null | head -n1)
      [ -n "$tok" ] || exit 0
      systemctl --user set-environment GITHUB_TOKEN="$tok"
    '';
  };
}

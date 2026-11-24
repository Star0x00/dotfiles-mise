# Everything lands in ~/.nix-profile/bin, which is first on the session PATH
# (systemd/user/niri.service.d/10-path.conf).
{ inputs, pkgs, ... }:
{
  packages = with pkgs; [
    # ---- CLI ----
    jq
    ripgrep
    fd
    fzf
    zoxide
    bat
    gh
    yazi
    just
    pandoc
    fastfetch
    btop
    starship
    glow
    eza
    tealdeer
    lazygit
    delta # the git pager, nixpkgs attr name is `delta`
    treefmt
    exercism
    just
    inputs.flyline.packages.${pkgs.stdenv.hostPlatform.system}.default

    # ---- tui ----
    pi-coding-agent

    # ---- languages / compilers ----
    go
    zig
    nodejs-slim
    nodejs-slim.npm
    pnpm
    uv
    stylua
    nixfmt

    # ---- documents / trees ----
    typst
    tinymist
    tree-sitter
    clang

    # ---- LSPs ----
    zls
    nixd
    nixfmt # nixd/helix formatter for .nix
    lua-language-server

    # ---- editors / pager ----
    neovim

    # ---- vcs ----
    jujutsu

    # ---- fonts ----
    maple-mono.NF-CN
    iosevka
    sarasa-gothic
    nerd-fonts.symbols-only
  ];
}

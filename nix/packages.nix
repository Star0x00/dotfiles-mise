# Global tools. This replaces `mise`'s ~/.config/mise/conf.d/00-tools.toml,
# except for the handful of packages that are not in nixpkgs and still come
# from mise (pi, maki, wwm, dsh, flyline, fx) -- see the bottom of this file.
#
# Everything lands in ~/.nix-profile/bin, which is first on the session PATH
# (systemd/user/niri.service.d/10-path.conf).
{ pkgs, ... }:
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

    # ---- tui ----
    pi-coding-agent

    # ---- languages / compilers ----
    go
    rustc
    cargo
    rustfmt
    clippy
    zig
    nodejs # also provides `npm` (built from source: cache lag for 24.22.2)
    pnpm
    uv
    stylua

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
    nerd-fonts.symbols-only
    nerd-fonts.iosevka
  ];

}

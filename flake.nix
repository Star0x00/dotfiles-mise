{
  description = "qwerhyy's user environment (nix-maid on Fedora Kinoite)";

  inputs = {
    nixpkgs = {
      url = "https://channels.nixos.org/nixos-unstable/nixexprs.tar.zst";
      flake = false;
    };
    nix-maid.url = "git+https://codeberg.org/viperML/nix-maid";
  };

  outputs =
    {
      self,
      nixpkgs,
      nix-maid,
    }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        config.allowUnfree = true;
      };
      # The eval nix-maid's functor does, spelled out so `options` can be exposed
      # for nixd (completion for `file.*`, `flatpak.*`, ...).
      maid = (import "${nix-maid}/src/maid" { inherit pkgs; }).eval [
        ./nix/packages.nix
        ./nix/dotfiles.nix
        ./nix/units.nix
        ./nix/flatpak.nix
      ];
    in
    {
      packages.${system}.default = maid.config.build.bundle;

      # Option declarations, for the nixd language server:
      #   options.<name>.expr = "(builtins.getFlake \"/home/$USER/dotfiles\").options"
      options = maid.options;
    };
}

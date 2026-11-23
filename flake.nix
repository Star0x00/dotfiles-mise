{
  description = "qwerhyy's user environment (nix-maid on Fedora Kinoite)";

  inputs = {
    nixpkgs = {
      url = "https://channels.nixos.org/nixos-unstable/nixexprs.tar.zst";
      flake = false;
    };
    nix-maid.url = "git+https://codeberg.org/viperML/nix-maid";
    flyline.url = "github:HalFrgrd/flyline";
  };

  outputs =
    {
      self,
      nixpkgs,
      ...
    }@inputs:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        config.allowUnfree = true;
      };
      maid = (import "${inputs.nix-maid}/src/maid" {
        inherit pkgs inputs;
      }).eval [
        ./nix/packages.nix
        ./nix/dotfiles.nix
        ./nix/units.nix
        ./nix/flatpak.nix
      ];
    in
    {
      packages.${system}.default = maid.config.build.bundle;

      # Everything the module eval produced, for poking at in `nix repl`:
      #   :lf .
      #   :p debug.config.file.xdg_data
      #   builtins.attrNames debug.options
      debug = maid;

      # Option declarations, for the nixd language server:
      #   options.<name>.expr = "(builtins.getFlake \"/home/$USER/dotfiles\").options"
      options = maid.options;
    };
}

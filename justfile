lock *input:
  @NIX_CONFIG="access-tokens = github.com=$(gh auth token)" nix flake {{ if input == "" { "lock" } else { "update " + input } }}

build:
  nix profile remove dotfiles && git add . && nix profile add . && activate

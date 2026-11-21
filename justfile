build:
  nix profile remove dotfiles && git add . && nix profile add . && activate

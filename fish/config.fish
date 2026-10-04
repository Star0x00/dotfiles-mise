# ~/.config/fish/config.fish — native, mise-managed via dotfiles repo

# Ensure user-local bins are on PATH
if not contains "$HOME/.local/bin" $PATH
    set -gx PATH "$HOME/.local/bin" $PATH
end
if not contains "$HOME/.local/share/npm/bin" $PATH
    set -gx PATH "$HOME/.local/share/npm/bin" $PATH
end

status is-login; and begin
    # Login-shell init (env comes from ~/.bashrc / environment.d)
end

status is-interactive; and begin
    set -gx BROWSER chrome
    set -gx EDITOR hx

    if test "$TERM" != dumb
        and command -q starship
        starship init fish | source
    end

    if command -q mise
        mise activate fish | source
    end

    if command -q direnv
        direnv hook fish | source
    end
end

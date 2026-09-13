// Command installer downloads the fonts declared in fonts.toml into
// ~/.local/share/fonts and rebuilds the fontconfig cache.
//
// Fonts are large, so none of them live in git: this program plus the
// `install-fonts` mise task are what reproduce them. Each family declares where it
// comes from, either an archive plus the members to take or a few plain file URLs,
// and everything lands in one directory of its own.
//
// Archives are read with HTTP range requests, so a family that only wants the ttf
// members of a 217 MiB zip transfers ~54 MiB instead of the whole file. A
// per-family state file records what was installed, so an unchanged machine checks
// local sizes and never touches the network.
//
//	go run . [-manifest FILE] [-root DIR] [-state DIR] [-only NAME,...] [-force]
package main

import (
	"archive/zip"
	"bufio"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/BurntSushi/toml"
)

//go:embed fonts.toml
var builtinManifest []byte

const ua = "fonts-installer/1.0 (+dotfiles)"

// manifest is fonts.toml: one entry per font family.
type manifest struct {
	Fonts map[string]family `toml:"fonts"`
}

// family is one font family: where its files come from, and where they go.
type family struct {
	URL   string   `toml:"url"`   // archive holding the members below
	Globs []string `toml:"globs"` // archive members to take, path.Match patterns
	Files []string `toml:"files"` // direct file URLs, used instead of url
	Dest  string   `toml:"dest"`  // directory under the font root, default family name
}

// entry is one installed file: the name it gets and the size it must have.
type entry struct {
	name string
	size int64 // 0 when unknown
}

// remote is an entry that can also be fetched.
type remote struct {
	entry
	open func() (io.ReadCloser, error)
}

func main() {
	manifestPath := flag.String("manifest", "", "manifest to read (default: the embedded fonts.toml)")
	root := flag.String("root", filepath.Join(home(), ".local", "share", "fonts"), "font directory")
	stateDir := flag.String("state", filepath.Join(home(), ".local", "state", "fonts"), "install state directory")
	only := flag.String("only", "", "comma-separated families to install (default: all)")
	force := flag.Bool("force", false, "download again even when the fonts are already installed")
	flag.Parse()

	if err := run(*manifestPath, *root, *stateDir, splitList(*only), *force); err != nil {
		fmt.Fprintln(os.Stderr, "fonts:", err)
		os.Exit(1)
	}
}

func run(manifestPath, root, stateDir string, only []string, force bool) error {
	m, err := load(manifestPath)
	if err != nil {
		return err
	}
	names, err := selectFamilies(m, only)
	if err != nil {
		return err
	}

	var dirs []string
	installed := 0
	for _, name := range names {
		added, dest, err := installFamily(name, m.Fonts[name], root, stateDir, force)
		if err != nil {
			return fmt.Errorf("%s: %w", name, err)
		}
		if added == 0 {
			fmt.Printf("%-16s up to date\n", name)
			continue
		}
		dirs = append(dirs, dest)
		installed += added
	}
	if installed > 0 {
		fcCache(dirs)
		fmt.Printf("fonts: %d files installed\n", installed)
	}
	return nil
}

// installFamily brings one family up to date and reports how many files it wrote.
func installFamily(name string, f family, root, stateDir string, force bool) (int, string, error) {
	dest := filepath.Join(root, f.dest(name))
	statePath := filepath.Join(stateDir, name+".state")
	spec := specHash(f)

	// Fast path: the state file lists what this directory holds, so an unchanged
	// machine only stats local files and never touches the network.
	if !force && upToDate(statePath, spec, dest) {
		return 0, dest, nil
	}

	remotes, err := f.remotes()
	if err != nil {
		return 0, dest, err
	}
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return 0, dest, err
	}
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		return 0, dest, err
	}

	var todo []remote
	for _, r := range remotes {
		if force || !exists(filepath.Join(dest, r.name), r.size) {
			todo = append(todo, r)
		}
	}
	if len(todo) == 0 {
		return 0, dest, writeState(statePath, spec, remotes)
	}

	fmt.Printf("%-16s installing %d/%d files into %s\n", name, len(todo), len(remotes), dest)
	added := 0
	for _, r := range todo {
		written, err := install(dest, r)
		if err != nil {
			return added, dest, err
		}
		fmt.Printf("  %-26s %s\n", r.name, size(written))
		added++
	}
	return added, dest, writeState(statePath, spec, remotes)
}

// remotes lists every file the family installs. Archive families read the remote
// index here, which is the one network access the state file cannot avoid.
func (f family) remotes() ([]remote, error) {
	if f.URL != "" {
		size, err := remoteSize(f.URL)
		if err != nil {
			return nil, err
		}
		zr, err := zip.NewReader(newHTTPReaderAt(f.URL, size), size)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", f.URL, err)
		}
		var out []remote
		for _, z := range zr.File {
			if matchAny(f.Globs, z.Name) {
				out = append(out, remote{entry{path.Base(z.Name), int64(z.UncompressedSize64)}, z.Open})
			}
		}
		if len(out) == 0 {
			return nil, fmt.Errorf("%s: no member matches %s", f.URL, strings.Join(f.Globs, " or "))
		}
		return out, nil
	}

	out := make([]remote, 0, len(f.Files))
	for _, u := range f.Files {
		r := remote{entry: entry{name: path.Base(u)}}
		r.open = func() (io.ReadCloser, error) { return httpGet(u) }
		out = append(out, r)
	}
	return out, nil
}

// install writes one file through a temp file: the rename is what publishes it, so
// fontconfig never sees a half-written font. It returns the bytes written.
func install(dest string, r remote) (int64, error) {
	rc, err := r.open()
	if err != nil {
		return 0, err
	}
	defer rc.Close()

	tmp, err := os.CreateTemp(dest, "."+r.name+".*")
	if err != nil {
		return 0, err
	}
	defer os.Remove(tmp.Name())

	n, err := io.Copy(tmp, rc)
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return n, fmt.Errorf("%s: %w", r.name, err)
	}
	if r.size > 0 && n != r.size {
		return n, fmt.Errorf("%s: got %d bytes, want %d", r.name, n, r.size)
	}
	if err := os.Chmod(tmp.Name(), 0o644); err != nil {
		return n, err
	}
	return n, os.Rename(tmp.Name(), filepath.Join(dest, r.name))
}

// exists reports whether p is already installed at the expected size.
func exists(p string, size int64) bool {
	st, err := os.Stat(p)
	return err == nil && (size == 0 || st.Size() == size)
}

// state lists what a family installed, so the next run can skip the remote index.
type state struct {
	spec  string
	files []entry
}

func upToDate(statePath, spec, dest string) bool {
	st, err := readState(statePath)
	if err != nil || st.spec != spec {
		return false
	}
	for _, e := range st.files {
		if !exists(filepath.Join(dest, e.name), e.size) {
			return false
		}
	}
	return true
}

func readState(p string) (state, error) {
	f, err := os.Open(p)
	if err != nil {
		return state{}, err
	}
	defer f.Close()

	var st state
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		if spec, ok := strings.CutPrefix(sc.Text(), "# spec "); ok {
			st.spec = spec
			continue
		}
		name, size, ok := strings.Cut(sc.Text(), " ")
		n, err := strconv.ParseInt(size, 10, 64)
		if !ok || err != nil {
			continue
		}
		st.files = append(st.files, entry{name, n})
	}
	if st.spec == "" || len(st.files) == 0 {
		return state{}, errors.New("no usable state")
	}
	return st, nil
}

func writeState(p, spec string, files []remote) error {
	var b strings.Builder
	fmt.Fprintf(&b, "# spec %s\n", spec)
	for _, r := range files {
		fmt.Fprintf(&b, "%d %s\n", r.size, r.name)
	}
	return os.WriteFile(p, []byte(b.String()), 0o644)
}

// specHash ties a state file to the manifest entry that produced it, so editing a
// family (new url, new globs) invalidates the old state.
func specHash(f family) string {
	sum := sha256.Sum256(fmt.Appendf(nil, "%#v", f))
	return hex.EncodeToString(sum[:8])
}

func load(path string) (*manifest, error) {
	data := builtinManifest
	if path != "" {
		var err error
		if data, err = os.ReadFile(path); err != nil {
			return nil, err
		}
	}
	m := &manifest{}
	if _, err := toml.Decode(string(data), m); err != nil {
		return nil, err
	}
	if len(m.Fonts) == 0 {
		return nil, errors.New("manifest declares no fonts")
	}
	for name, f := range m.Fonts {
		switch {
		case f.URL == "" && len(f.Files) == 0:
			return nil, fmt.Errorf("fonts.%s: needs url or files", name)
		case f.URL != "" && len(f.Files) > 0:
			return nil, fmt.Errorf("fonts.%s: url and files are mutually exclusive", name)
		case f.URL != "" && len(f.Globs) == 0:
			return nil, fmt.Errorf("fonts.%s: url needs globs", name)
		}
	}
	return m, nil
}

func selectFamilies(m *manifest, only []string) ([]string, error) {
	if len(only) == 0 {
		names := make([]string, 0, len(m.Fonts))
		for name := range m.Fonts {
			names = append(names, name)
		}
		sort.Strings(names)
		return names, nil
	}
	for _, name := range only {
		if _, ok := m.Fonts[name]; !ok {
			return nil, fmt.Errorf("unknown font %q", name)
		}
	}
	return only, nil
}

func (f family) dest(name string) string {
	if f.Dest != "" {
		return f.Dest
	}
	return name
}

func matchAny(globs []string, name string) bool {
	for _, g := range globs {
		if ok, _ := path.Match(g, name); ok {
			return true
		}
	}
	return false
}

func httpGet(url string) (io.ReadCloser, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", ua)
	resp, err := (&http.Client{Timeout: 10 * time.Minute}).Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("%s: %s", url, resp.Status)
	}
	return resp.Body, nil
}

// remoteSize asks for a length up front: zip.NewReader needs the archive size to
// seek to the central directory.
func remoteSize(url string) (int64, error) {
	req, err := http.NewRequest(http.MethodHead, url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("User-Agent", ua)
	resp, err := (&http.Client{Timeout: time.Minute}).Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("%s: %s", url, resp.Status)
	}
	if resp.ContentLength <= 0 {
		return 0, fmt.Errorf("%s: no Content-Length", url)
	}
	return resp.ContentLength, nil
}

func fcCache(dirs []string) {
	if _, err := exec.LookPath("fc-cache"); err != nil {
		return
	}
	out, err := exec.Command("fc-cache", append([]string{"-f"}, dirs...)...).CombinedOutput()
	if err != nil {
		fmt.Fprintf(os.Stderr, "fonts: fc-cache: %v: %s\n", err, strings.TrimSpace(string(out)))
		return
	}
	fmt.Printf("fonts: font cache rebuilt for %s\n", strings.Join(dirs, " "))
}

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}

func home() string { return os.Getenv("HOME") }

func size(n int64) string {
	if n <= 0 {
		return "-"
	}
	return fmt.Sprintf("%7.2f MiB", float64(n)/(1<<20))
}

// blockSize/maxBlocks trade HTTP requests against memory: archive/zip reads the
// central directory, then small local headers, then ~32 KiB at a time while
// inflating, so one block satisfies many reads.
const (
	blockSize = 4 << 20
	maxBlocks = 6
)

// httpReaderAt is an io.ReaderAt over HTTP range requests with a small block cache,
// which is what lets archive/zip read a remote archive. It is also why a family
// only pays for the members it actually takes.
type httpReaderAt struct {
	url    string
	size   int64
	client *http.Client

	mu     sync.Mutex
	blocks map[int64][]byte
	order  []int64
}

func newHTTPReaderAt(url string, size int64) *httpReaderAt {
	return &httpReaderAt{
		url:    url,
		size:   size,
		client: &http.Client{Timeout: 5 * time.Minute},
		blocks: map[int64][]byte{},
	}
}

func (r *httpReaderAt) ReadAt(p []byte, off int64) (int, error) {
	n := 0
	for n < len(p) && off+int64(n) < r.size {
		start := (off + int64(n)) / blockSize * blockSize
		blk, err := r.block(start)
		if err != nil {
			return n, err
		}
		n += copy(p[n:], blk[off+int64(n)-start:])
	}
	if n < len(p) {
		return n, io.EOF
	}
	return n, nil
}

func (r *httpReaderAt) block(start int64) ([]byte, error) {
	r.mu.Lock()
	blk, cached := r.blocks[start]
	r.mu.Unlock()
	if cached {
		return blk, nil
	}

	length := min(blockSize, r.size-start)
	req, err := http.NewRequest(http.MethodGet, r.url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", start, start+length-1))
	req.Header.Set("User-Agent", ua)
	resp, err := r.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusPartialContent {
		return nil, fmt.Errorf("%s: range request rejected (%s)", r.url, resp.Status)
	}
	if blk, err = io.ReadAll(resp.Body); err != nil {
		return nil, err
	}
	if int64(len(blk)) != length {
		return nil, errors.New("short range response")
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.order) == maxBlocks {
		delete(r.blocks, r.order[0])
		r.order = r.order[1:]
	}
	r.blocks[start] = blk
	r.order = append(r.order, start)
	return blk, nil
}

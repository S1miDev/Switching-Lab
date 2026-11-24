// Linux topic catalogue: every Linux topic once, keyed by a stable id that starts with lx- (so it never clashes with a
// Switching topic in the saved progress). The Linux page points the shared names (CATALOGUE, DOMAINS, REF_GROUPS,
// REF_TEXT) at these in js/linux/track.js; the landing page's Profile reads them as they are. Each topic has a lab
// (LINUX_LABS[id] in js/linux/labs.js) at every difficulty. Reference commands are [command, options, purpose].
const LINUX_DOMAINS = {
  1: 'Files and navigation',
  2: 'Text and search',
  3: 'Permissions and users',
  4: 'Processes and packages',
};

// the Reference page groups, in page order
const LINUX_REF_GROUPS = ['Files and navigation', 'Text and search', 'Permissions and users', 'Processes and packages'];

// the Reference page labels for this track (js/reference.js)
const LINUX_REF_TEXT = {
  commands: 'Commands', mode: 'Options', verifyMode: 'shell', verifyPurpose: 'Check the result.',
  graded: 'Random tasks, graded against the simulated system state.',
};

const LX_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

const LINUX_CATALOGUE = {
  'lx-nav': {
    name: 'Navigation',
    domain: 1,
    desc: 'Find your way around the filesystem with pwd, ls and cd, using absolute and relative paths.',
    keywords: ['pwd', 'ls', 'cd', 'path', 'hidden files', 'home directory'],
    refGroup: 'Files and navigation',
    labLevels: LX_LEVELS,
    ref: {
      summary: 'Where you are, what is here, and how to move: pwd, ls and cd.',
      cta: 'Practise moving around the filesystem in the lab',
      intro: 'Everything on Linux lives in one tree that starts at / (the root). The shell always has a current directory; commands read relative paths from there.',
      know: [
        'An absolute path starts with / (/var/log); a relative path starts from the current directory (logs/app.log).',
        '~ is your home directory (/home/student), ~anna is the home directory of the user anna.',
        '. is the current directory and .. the one above it, so cd .. goes up one level.',
        'Names that start with a dot are hidden: ls shows them only with -a (or -A, which leaves out . and ..).',
        'ls -l shows the type and permissions, the owner and group, the size and the date of each entry; -h makes sizes readable (4.0K, 15M).',
        'cd with no argument goes home, and cd - goes back to the directory you were in before.',
      ],
      commands: [
        ['pwd', '', 'Print the current (working) directory.'],
        ['ls [DIR]', '', 'List the entries of a directory, the current one by default.'],
        ['ls -a', '-a: all, hidden entries and . and .. too', 'Show hidden files.'],
        ['ls -A', '-A: almost all, hidden but not . and ..', 'Show hidden files without . and ..'],
        ['ls -l', '-l: long listing', 'Show mode, links, owner, group, size and date.'],
        ['ls -lh', '-h: human-readable sizes', 'Long listing with sizes like 4.0K and 15M.'],
        ['ls -d DIR', '-d: the directory itself', 'Show a directory, not what is inside it.'],
        ['cd DIR', '', 'Change to a directory (absolute or relative path).'],
        ['cd ..', '', 'Go up one directory.'],
        ['cd ~  |  cd', '', 'Go to your home directory.'],
        ['cd -', '', 'Go back to the previous directory (and print it).'],
      ],
      verify: ['pwd', 'ls -la', 'ls -ld DIR'],
      mistakes: [
        'Forgetting that ls hides dotfiles: a "missing" .bashrc is only hidden.',
        'Mixing up / (the root) and ~ (your home): cd / and cd ~ go to very different places.',
        'Typing a relative path from the wrong directory: check with pwd first.',
        'Reading the size of a directory in ls -l (4096) as the size of what is inside it.',
      ],
    },
  },
  'lx-files': {
    name: 'Files and directories',
    domain: 1,
    desc: 'Create, copy, move, rename and delete files and directories with touch, mkdir, cp, mv, rm and rmdir.',
    keywords: ['touch', 'mkdir', 'cp', 'mv', 'rm', 'rmdir', 'copy', 'move', 'delete'],
    refGroup: 'Files and navigation',
    labLevels: LX_LEVELS,
    ref: {
      summary: 'Make, copy, move and delete files and directories.',
      cta: 'Practise working with files in the lab',
      intro: 'Most daily work on a Linux server is creating, copying, moving and removing files. These commands do it, and none of them asks for confirmation.',
      know: [
        'touch FILE creates an empty file, or updates the time of one that exists.',
        'mkdir -p a/b/c makes every missing directory on the way and does not complain if they exist.',
        'cp copies files; a directory needs -r. cp SOURCE DIR/ puts the copy inside DIR.',
        'mv moves and renames in one step: mv old new renames, mv file dir/ moves.',
        'rm deletes files for good (there is no recycle bin). rm -r deletes a directory and everything in it; -f never asks and ignores missing files.',
        'rmdir only removes empty directories, which makes it a safe check.',
        'Globs pick several names at once: *.txt is every .txt file, ? is one character.',
      ],
      commands: [
        ['touch FILE...', '', 'Create empty files, or update their time.'],
        ['mkdir DIR...', '', 'Create directories.'],
        ['mkdir -p PATH', '-p: make parents as needed, no error if it exists', 'Create a whole path at once.'],
        ['cp SOURCE DEST', '', 'Copy a file to a new name or into a directory.'],
        ['cp -r DIR DEST', '-r: recursive', 'Copy a directory and everything in it.'],
        ['mv SOURCE DEST', '', 'Move or rename a file or directory.'],
        ['rm FILE...', '', 'Delete files.'],
        ['rm -r DIR', '-r: recursive', 'Delete a directory and its contents.'],
        ['rm -rf DIR', '-f: force, never ask', 'Delete without asking and ignore missing files.'],
        ['rmdir DIR', '', 'Delete an empty directory.'],
      ],
      verify: ['ls -l', 'ls -l DIR', 'cat FILE'],
      mistakes: [
        'cp of a directory without -r: cp says "omitting directory" and copies nothing.',
        'mv onto an existing file name: the old file is replaced without a warning.',
        'rm -rf with a typo or a stray space (rm -rf / tmp): always read the line before Enter.',
        'Expecting rmdir to remove a directory that still has files in it.',
      ],
    },
  },
};

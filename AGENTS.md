- Before committing, ALWAYS run auto-formatting with `qlty fmt`
- Before finishing, ALWAYS run
  `qlty check <path_to_changed_files> --fix --level=low` and fix any lint
  errors. Replace `<path_to_changed_files>` with the actual path(s) to your
  changed files (you can use `git diff --name-only` to find changed files).
- Before finishing, ALWAYS run `qlty smells <path_to_changed_files>` and fix any
  alerts. Replace `<path_to_changed_files>` with the actual path(s) to your
  changed files (you can use `git diff --name-only` to find changed files).

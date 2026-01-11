- Before committing, ALWAYS run auto-formatting with `qlty fmt`
- Before finishing, ALWAYS run
  `qlty check <path_to_changed_files> --fix --level=low` and fix any lint errors
- Before finishing, ALWAYS run `qlty smells <path_to_changed_files>` and fix any
  alerts

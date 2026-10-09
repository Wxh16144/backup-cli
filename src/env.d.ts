// Custom env vars are not typed by @types/node; declare them for autocomplete and editor type-checking.
declare namespace NodeJS {
  interface ProcessEnv {
    /** User home directory */
    HOME?: string;
    /** Set to the command name to enable debug logging */
    DEBUG?: string;
    /** Base directory for XDG config files */
    XDG_CONFIG_HOME?: string;
    /** Custom config file path, overrides ~/.backuprc */
    BACKUP_CONFIG_FILE?: string;
    /** Directory of custom app configs, overrides ~/.backup */
    BACKUP_CUSTOM_APP_DIR?: string;
    /** Directory of default app configs, overrides the bundled mackup apps */
    BACKUP_DEFAULT_APP_DIR?: string;
    /** Set to "true" to skip prompts; conflicts are skipped instead */
    BACKUP_QUIET?: string;
    /** Upstream $HOME used when restoring someone else's backup */
    BACKUP_UPSTREAM_HOME?: string;
    /** Set to "true" to let --force overwrite on restore */
    BACKUP_FORCE_RESTORE?: string;
  }
}

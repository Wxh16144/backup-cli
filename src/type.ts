export type MaybeArray<T> = T | T[];

export type Obj = Record<string, any>;

export interface Argv {
  branch?: string;
  glob?: string;
  help?: boolean;
  version?: boolean;
  list?: boolean;
  debug?: boolean;
  force?: boolean;
  config?: string;
  restore?: boolean;
  _: string[];
}

// appConfig
export interface AppConfig {
  application: {
    name: string;
  }
  configuration_files: Record<string, boolean>
}

// config
type Storage = {
  directory?: string;
  path?: string;
}

export interface Config {
  storage?: Storage;
  applications_to_sync?: Record<string, boolean>;
  applications_to_ignore?: Record<string, boolean>;
}